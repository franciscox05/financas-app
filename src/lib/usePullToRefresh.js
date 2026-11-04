import { useEffect, useRef, useState } from 'react'

// Distância (px, já com resistência) a partir da qual largar o dedo recarrega a página.
export const PULL_THRESHOLD = 70
// Máximo que o indicador desce, para o gesto não "arrastar" o ecrã inteiro.
const PULL_MAX = 110
// O dedo anda mais do que o indicador: dá a sensação física de estar a puxar contra uma mola.
const RESISTANCE = 0.5
// Mesmo que os dados cheguem num instante, o indicador fica visível o suficiente para se perceber
// que alguma coisa aconteceu.
const MIN_SPIN_MS = 500

// "Puxar para atualizar" à mão: o body tem `overscroll-behavior-y: none` (sem bounce nativo no
// iOS), por isso o gesto só existe se for a app a desenhá-lo. Só arranca com a página no topo e
// fora de modais/folhas, para não competir com o scroll normal nem com listas dentro de diálogos.
export function usePullToRefresh(onRefresh) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef(null)
  const pullRef = useRef(0)
  const busy = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    function setBoth(v) {
      pullRef.current = v
      setPull(v)
    }

    function onStart(e) {
      if (busy.current || e.touches.length !== 1) return
      if (window.scrollY > 0) return
      // O Modal bloqueia o scroll do body enquanto está aberto: cobre a folha e o fundo escurecido.
      if (document.body.style.overflow === 'hidden') return
      if (e.target.closest?.('[role="dialog"], [data-no-pull]')) return
      start.current = e.touches[0].clientY
    }

    function onMove(e) {
      if (start.current == null) return
      const dy = e.touches[0].clientY - start.current
      // Se o utilizador começou a fazer scroll para baixo (ou a página saiu do topo), desiste.
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) setBoth(0)
        if (dy < 0) start.current = null
        return
      }
      setBoth(Math.min(dy * RESISTANCE, PULL_MAX))
    }

    async function onEnd() {
      if (start.current == null) return
      start.current = null
      if (pullRef.current < PULL_THRESHOLD) {
        setBoth(0)
        return
      }
      busy.current = true
      setRefreshing(true)
      setBoth(PULL_THRESHOLD)
      try {
        await Promise.all([
          Promise.resolve(onRefreshRef.current?.()),
          new Promise((r) => setTimeout(r, MIN_SPIN_MS)),
        ])
      } finally {
        busy.current = false
        setRefreshing(false)
        setBoth(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return { pull, refreshing }
}
