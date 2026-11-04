import { useEffect, useRef, useState } from 'react'

// Distância (px, já com resistência) a partir da qual largar o dedo recarrega a página.
export const PULL_THRESHOLD = 64
// Altura a que o conteúdo fica parado enquanto recarrega (o indicador fica centrado nesse espaço).
const HOLD_AT = 56
// Tamanho do indicador redondo (px) — tem de bater com size-9 no AppLayout.
const INDICATOR_SIZE = 36
// Teto da "mola": por mais que se puxe, o conteúdo nunca desce mais do que isto.
const PULL_LIMIT = 140
const RELEASE_MS = 320
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
// Mesmo que os dados cheguem num instante, o indicador fica visível o suficiente para se perceber
// que alguma coisa aconteceu.
const MIN_SPIN_MS = 600

// Resistência como no iOS: no início acompanha o dedo quase 1:1 e vai ficando cada vez mais
// pesado, sem nunca passar de PULL_LIMIT. Dá a sensação física de puxar contra uma mola.
function rubberBand(dy) {
  return PULL_LIMIT * (1 - 1 / ((dy * 0.55) / PULL_LIMIT + 1))
}

// "Puxar para atualizar" à mão: o body tem `overscroll-behavior-y: none` (sem bounce nativo no
// iOS), por isso o gesto só existe se for a app a desenhá-lo.
//
// Para ser fluido, o movimento NÃO passa pelo React: os estilos são escritos diretamente no DOM
// (contentRef/indicatorRef) e só com `transform`/`opacity`, que a GPU anima sem recalcular o layout.
// O React só volta a desenhar em 2 momentos: quando passa o limiar (`armed`) e ao recarregar.
export function usePullToRefresh(onRefresh, { contentRef, indicatorRef }) {
  const [refreshing, setRefreshing] = useState(false)
  const [armed, setArmed] = useState(false)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    let startY = null
    let pull = 0
    let busy = false
    let frame = 0
    let cleanupTimer = 0

    function paint(value, animate) {
      const content = contentRef.current
      const indicator = indicatorRef.current
      const transition = animate ? `transform ${RELEASE_MS}ms ${EASE_OUT}` : 'none'
      if (content) {
        content.style.transition = transition
        content.style.transform = `translate3d(0, ${value}px, 0)`
      }
      if (indicator) {
        const progress = Math.min(value / PULL_THRESHOLD, 1)
        // Centrado no espaço que se abre entre o cabeçalho e o conteúdo; começa escondido por baixo
        // do cabeçalho (z-index maior) e vai crescendo e aparecendo com o dedo.
        const y = value / 2 - INDICATOR_SIZE / 2
        indicator.style.transition = animate ? `transform ${RELEASE_MS}ms ${EASE_OUT}, opacity ${RELEASE_MS}ms ${EASE_OUT}` : 'none'
        indicator.style.transform = `translate3d(-50%, ${y}px, 0) scale(${0.5 + 0.5 * progress})`
        indicator.style.opacity = String(progress)
        indicator.style.setProperty('--ptr-rotate', `${value * 3}deg`)
      }
    }

    // No fim da animação de regresso, tira-se o transform: um `transform` deixado no <main>
    // passaria a ser a referência dos popups `position: fixed` lá dentro (ficariam mal colocados).
    function settle() {
      clearTimeout(cleanupTimer)
      cleanupTimer = setTimeout(() => {
        if (pull !== 0 || busy) return
        if (contentRef.current) {
          contentRef.current.style.transform = ''
          contentRef.current.style.transition = ''
        }
      }, RELEASE_MS + 20)
    }

    function onStart(e) {
      if (busy || e.touches.length !== 1) return
      if (window.scrollY > 0) return
      // O Modal bloqueia o scroll do body enquanto está aberto: cobre a folha e o fundo escurecido.
      if (document.body.style.overflow === 'hidden') return
      if (e.target.closest?.('[role="dialog"], [data-no-pull]')) return
      startY = e.touches[0].clientY
    }

    function onMove(e) {
      if (startY == null) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || window.scrollY > 0) {
        // Começou a fazer scroll normal para baixo: desiste do gesto sem deixar nada pendurado.
        if (dy < 0) startY = null
        if (pull !== 0) {
          pull = 0
          paint(0, true)
          setArmed(false)
          settle()
        }
        return
      }
      const next = rubberBand(dy)
      const wasArmed = pull >= PULL_THRESHOLD
      pull = next
      if (wasArmed !== next >= PULL_THRESHOLD) setArmed(next >= PULL_THRESHOLD)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => paint(pull, false))
    }

    async function onEnd() {
      if (startY == null) return
      startY = null
      cancelAnimationFrame(frame)
      if (pull < PULL_THRESHOLD) {
        pull = 0
        paint(0, true)
        setArmed(false)
        settle()
        return
      }
      busy = true
      setRefreshing(true)
      paint(HOLD_AT, true)
      try {
        await Promise.all([
          Promise.resolve(onRefreshRef.current?.()),
          new Promise((r) => setTimeout(r, MIN_SPIN_MS)),
        ])
      } finally {
        busy = false
        pull = 0
        setRefreshing(false)
        setArmed(false)
        paint(0, true)
        settle()
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(cleanupTimer)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [contentRef, indicatorRef])

  return { refreshing, armed }
}
