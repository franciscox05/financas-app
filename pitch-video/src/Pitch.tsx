import {
  AbsoluteFill,
  Audio,
  Easing,
  cancelRender,
  continueRender,
  delayRender,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import {
  CAMERA,
  MUSIC_DROP,
  NOTIFICATION,
  ORBIT,
  PHONE_SIDE,
  SCENES,
  SCREENS,
  SFX,
  SIDE_KEYS,
  SPIN,
  TAPS,
  isRitaScreen,
} from './timeline'

// Inter servida de public/fonts (fonte variável, um ficheiro por subset): o render deixa de
// depender do Google Fonts, que já o fez falhar a meio com a rede em baixo.
const fontFamily = 'Inter'
const FONT_FILES = [
  {
    file: 'inter-latin.woff2',
    unicodeRange:
      'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  },
  {
    file: 'inter-latin-ext.woff2',
    unicodeRange:
      'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  },
]
const fontHandle = delayRender('Inter local')
Promise.all(
  FONT_FILES.map(({ file, unicodeRange }) =>
    new FontFace(fontFamily, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, {
      weight: '100 900',
      unicodeRange,
    })
      .load()
      .then((face) => document.fonts.add(face)),
  ),
).then(() => continueRender(fontHandle), (err) => cancelRender(err))

// Faixa gerada por sfx-gen.mjs; passar music: '' para render sem música.
export const pitchSchemaDefaults = { vertical: false, scheme: 'dark', music: 'music/groove.wav' }
type Props = typeof pitchSchemaDefaults

const GREEN = '#22c55e'
const easeOut = Easing.bezier(0.16, 1, 0.3, 1)
const easeInOut = Easing.bezier(0.65, 0, 0.35, 1)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// Captura original: 390x844 CSS px a 3x.
const CAPTURE_W = 390
const CAPTURE_H = 844
// Barra de estado do iOS por cima da captura (a app corre em PWA com safe-area).
const STATUS_H = 50
// Zona do indicador "home" por baixo (safe-area do iPhone): sem ela a barra de navegação
// da app ficava colada ao fundo e cortada pelos cantos redondos do ecrã.
const HOME_H = 34

export const Pitch = ({ vertical, scheme, music }: Props) => (
  <AbsoluteFill style={{ backgroundColor: '#0a0a0b', fontFamily, color: '#fafafa' }}>
    <Backdrop vertical={vertical} />

    <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration}>
      <ProblemScene vertical={vertical} />
    </Sequence>

    <PhoneStage vertical={vertical} scheme={scheme} />

    <Sequence from={SCENES.split.from} durationInFrames={SCENES.split.duration}>
      <Caption
        vertical={vertical}
        phoneSide={PHONE_SIDE.split}
        eyebrow="Dividir a conta"
        title="Pagas tu, divides por todos."
        subtitle="60 € de sushi a quatro? Um toque e cada um fica com os seus 15 €."
      />
    </Sequence>
    <Sequence from={SCENES.sync.from} durationInFrames={SCENES.sync.duration}>
      <Caption
        vertical={vertical}
        phoneSide={PHONE_SIDE.sync}
        eyebrow="Amigos ligados"
        title="Chega-lhe ao telemóvel."
        subtitle="A Rita confirma e fica certo dos dois lados. Sem prints, sem discussões."
      >
        <PhoneOwner />
      </Caption>
    </Sequence>
    <Sequence from={SCENES.friends.from} durationInFrames={SCENES.friends.duration}>
      <Caption
        vertical={vertical}
        phoneSide={PHONE_SIDE.friends}
        eyebrow="Amigos"
        title="Sabes sempre quem te deve."
        subtitle="O saldo de cada amigo, e um lembrete por WhatsApp num toque."
      />
    </Sequence>
    <Sequence from={SCENES.networth.from} durationInFrames={SCENES.networth.duration}>
      <Caption
        vertical={vertical}
        phoneSide={PHONE_SIDE.networth}
        eyebrow="Património"
        title="Tudo num só sítio."
        subtitle="Banco, XTB, Trade Republic e poupança, mês a mês."
      />
    </Sequence>
    <Sequence from={SCENES.privacy.from} durationInFrames={SCENES.privacy.duration}>
      <Caption
        vertical={vertical}
        phoneSide={PHONE_SIDE.privacy}
        eyebrow="Modo privacidade"
        title="Abre no metro."
        subtitle="Um toque e ninguém vê quanto tens."
      />
    </Sequence>

    <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration}>
      <CtaScene />
    </Sequence>

    <SoundDesign music={music} />
  </AbsoluteFill>
)

// Fundo escuro com um brilho verde que acompanha o telemóvel. Em vez de pulsar a cada
// bombo (parecia uma discoteca), respira devagar (~6 s por ciclo) a partir do drop.
const Backdrop = ({ vertical }: { vertical: boolean }) => {
  const frame = useCurrentFrame()
  const base = interpolate(frame, [MUSIC_DROP - 10, MUSIC_DROP + 30], [0.35, 1], clamp)
  const breathe = frame >= MUSIC_DROP ? Math.sin(((frame - MUSIC_DROP) / 180) * Math.PI * 2) : 0
  const glow = base * (1 + 0.08 * breathe)
  const side = phoneSide(frame)
  const position = vertical ? '50% 68%' : `${50 + side * 20}% 50%`
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${position}, rgba(34,197,94,${0.3 * glow}) 0%, rgba(34,197,94,${0.1 * glow}) 30%, rgba(34,197,94,0) 58%)`,
      }}
    />
  )
}

// --- Cena 1: o problema -------------------------------------------------------

// Posições em fração de meia largura/altura, para servir 16:9 e 9:16.
const SCATTERED = [
  { label: '"Quem pagou o sushi?"', x: -0.62, y: -0.56, d: 0 },
  { label: '"Manda MB Way"', x: 0.6, y: -0.62, d: 4 },
  { label: 'Excel de 2023', x: -0.58, y: 0.46, d: 8 },
  { label: '"Já te paguei?"', x: 0.56, y: 0.52, d: 12 },
  { label: 'App do banco', x: -0.08, y: 0.72, d: 16 },
  { label: 'Grupo do jantar (47)', x: 0.12, y: -0.76, d: 20 },
]

const ProblemScene = ({ vertical }: { vertical: boolean }) => {
  const frame = useCurrentFrame()
  const { durationInFrames, width, height } = useVideoConfig()
  const exit = interpolate(frame, [durationInFrames - 14, durationInFrames], [1, 0], {
    ...clamp,
    easing: easeInOut,
  })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: exit }}>
      {SCATTERED.map((chip) => {
        const appear = interpolate(frame, [chip.d, chip.d + 18], [0, 1], { ...clamp, easing: easeOut })
        const drift = Math.sin((frame + chip.d * 7) / 40) * 8
        return (
          <div
            key={chip.label}
            style={{
              position: 'absolute',
              transform: `translate(${(chip.x * width) / 2}px, ${(chip.y * height) / 2 + drift}px)`,
              opacity: appear * 0.55,
              filter: 'blur(1.5px)',
              padding: '14px 24px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              fontSize: 28,
              color: '#a3a3a3',
            }}
          >
            {chip.label}
          </div>
        )
      })}
      <div style={{ textAlign: 'center', maxWidth: vertical ? 900 : 1600 }}>
        <RevealLine delay={6} size={vertical ? 76 : 72} weight={600}>
          Pagaste o jantar de todos.
        </RevealLine>
        <RevealLine delay={50} size={vertical ? 76 : 72} weight={600} color="#737373">
          Agora é cobrar no grupo do WhatsApp.
        </RevealLine>
      </div>
    </AbsoluteFill>
  )
}

// --- Telemóvel ---------------------------------------------------------------

// O telemóvel é um objeto 3D em CSS: frente (ecrã), costas e espessura feita de camadas
// empilhadas em Z. O ângulo vem de ORBIT (de um lado para o outro entre cenas), mais uma
// oscilação lenta e a volta de 360° na troca Sofia → Rita (SPIN).
// Pose do telemóvel num frame: câmara (zoom/foco) + ângulos. Função pura, para se poder
// calcular também o frame anterior (velocidade) sem duplicar a lógica.
// Lado do telemóvel (-1 esquerda .. 1 direita), a deslizar entre cenas.
const phoneSide = (frame: number) =>
  interpolate(frame, SIDE_KEYS.map((k) => k.at), SIDE_KEYS.map((k) => k.side), { ...clamp, easing: easeInOut })

function phonePose(frame: number, fps: number, vertical: boolean) {
  const enter = spring({ frame: frame - SCENES.split.from, fps, config: { damping: 18, mass: 1.1, stiffness: 70 } })
  const leave = interpolate(frame, [SCENES.cta.from - 4, SCENES.cta.from + 20], [0, 1], { ...clamp, easing: easeInOut })

  // Câmara: interpolação entre keyframes, com easing em cada troço.
  const at = CAMERA.map((k) => k.at)
  // Em vertical o telemóvel já ocupa a largura toda: sem zoom, senão tapa o texto.
  const zoom = vertical ? 1 : interpolate(frame, at, CAMERA.map((k) => k.zoom), { ...clamp, easing: easeInOut })
  const focusY = vertical ? 0.5 : interpolate(frame, at, CAMERA.map((k) => k.focusY), { ...clamp, easing: easeInOut })

  // Ângulos: keyframes + oscilação (que some nos zooms, para o texto ficar parado).
  const orbitAt = ORBIT.map((k) => k.at)
  const calm = interpolate(zoom, [1, 1.25], [1, 0], clamp)
  const amount = vertical ? 0.45 : 1
  const spin = interpolate(frame, [SPIN.from, SPIN.to], [0, 360], { ...clamp, easing: easeInOut })
  // Ao atravessar o ecrã, inclina-se para o lado para onde vai (proporcional à velocidade).
  // Em vertical o texto fica sempre centrado por cima, por isso o telemóvel não troca de
  // lado: ficava descentrado em relação ao texto sem nada do outro lado a equilibrar.
  const side = vertical ? 0 : phoneSide(frame)
  const lean = vertical ? 0 : (side - phoneSide(frame - 1)) * 75
  const rotY =
    (interpolate(frame, orbitAt, ORBIT.map((k) => k.y), { ...clamp, easing: easeInOut }) +
      Math.sin(frame / 38) * 3.5 * calm) *
      amount +
    spin +
    lean +
    (1 - enter) * -62 + // entra de lado...
    leave * 55 // ...e sai a rodar para o outro
  const rotX =
    (interpolate(frame, orbitAt, ORBIT.map((k) => k.x), { ...clamp, easing: easeInOut }) +
      Math.sin(frame / 53 + 1) * 1.8 * calm) *
      amount +
    (1 - enter) * 22
  const rotZ = (1 - enter) * -8 + Math.sin(frame / 71) * 0.8 * calm
  const depth = (1 - enter) * -700 - leave * 260
  return { enter, leave, zoom, focusY, rotY, rotX, rotZ, depth, side }
}

const PhoneStage = ({ vertical, scheme }: { vertical: boolean; scheme: string }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const start = SCENES.split.from
  const end = SCENES.cta.from

  if (frame < start - 2 || frame > end + 24) return null

  const { enter, leave, zoom, focusY, rotY, rotX, rotZ, depth, side } = phonePose(frame, fps, vertical)
  // Velocidade de rotação (graus/frame): o vidro brilha mais enquanto o telemóvel se mexe.
  const prev = phonePose(frame - 1, fps, vertical)
  const speed = Math.hypot(rotY - prev.rotY, rotX - prev.rotX)

  const screenW = vertical ? 550 : 400
  const k = screenW / CAPTURE_W
  const screenH = (CAPTURE_H + STATUS_H + HOME_H) * k
  const bezel = screenW * 0.035
  const bodyW = screenW + bezel * 2
  const bodyH = screenH + bezel * 2
  const radius = screenW * 0.16
  const thickness = screenW * 0.055
  const offsetY = (0.5 - focusY) * screenH * zoom

  const left = `${50 + side * 20}%`
  const top = vertical ? '61.5%' : '50%'

  // Ângulo efetivo face à câmara (0 = de frente), para o reflexo e a sombra.
  const facing = ((((rotY % 360) + 540) % 360) - 180) // -180..180
  // Reflexo: uma luz fixa à frente, à esquerda e acima. Ao rodar o telemóvel, o ponto
  // onde a luz bate no vidro corre ao contrário do ângulo (rotY e rotX), atravessando o
  // ecrã inteiro entre -25° e +25°. Só aparece enquanto o telemóvel roda depressa (volta
  // de 360°, viragens, deslizes de lado): parado ou a oscilar devagar o ecrã fica limpo,
  // e mesmo no pico é um brilho discreto.
  const glareX = screenW * (0.5 - facing / 25) // centro da faixa (px)
  const glareY = screenH * (0.3 + rotX / 30)
  const glareStrength = interpolate(speed, [0.35, 1.2, 6], [0, 0.07, 0.16], clamp)
  const bezelLight = 145 + facing * 3

  const face: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: radius,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  }

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        transform: `translate(-50%, -50%) translateY(${offsetY}px) scale(${zoom})`,
        opacity: Math.min(1, enter * 1.6) * (1 - leave),
      }}
    >
      {/* Sombra no "chão": encolhe e afasta-se quando o telemóvel roda ou recua. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: bodyH * 0.96,
          width: bodyW * (0.9 - Math.abs(Math.sin((rotY * Math.PI) / 180)) * 0.35),
          height: bodyW * 0.12,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(0,0,0,0.7), rgba(0,0,0,0))',
          filter: 'blur(14px)',
          opacity: enter * (1 - leave) * 0.9,
        }}
      />
      <div style={{ perspective: vertical ? 2400 : 1700, perspectiveOrigin: '50% 45%' }}>
        <div
          style={{
            position: 'relative',
            width: bodyW,
            height: bodyH,
            transformStyle: 'preserve-3d',
            transform: `translateZ(${depth}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
          }}
        >
          {/* Espessura: aro metálico em camadas, entre as costas e a frente. */}
          {Array.from({ length: 14 }, (_, i) => {
            const z = -thickness / 2 + (thickness * i) / 13
            const light = 0.55 + 0.45 * Math.sin((i / 13) * Math.PI)
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: radius,
                  transform: `translateZ(${z}px)`,
                  background: `linear-gradient(${90 + facing}deg, rgb(${58 * light},${58 * light},${62 * light}), rgb(${120 * light},${120 * light},${128 * light}) 50%, rgb(${48 * light},${48 * light},${52 * light}))`,
                }}
              />
            )
          })}

          {/* Costas: vidro grafite, câmaras e logótipo. */}
          <div
            style={{
              ...face,
              transform: `rotateY(180deg) translateZ(${thickness / 2 + 0.5}px)`,
              background: 'linear-gradient(160deg, #3b3b40 0%, #232326 45%, #18181a 100%)',
              boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.08)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: bodyW * 0.07,
                top: bodyW * 0.07,
                width: bodyW * 0.4,
                height: bodyW * 0.4,
                borderRadius: bodyW * 0.1,
                background: 'linear-gradient(145deg, #2e2e33, #1d1d20)',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.06), 0 8px 20px rgba(0,0,0,0.5)',
              }}
            >
              {[
                [0.27, 0.27],
                [0.73, 0.5],
                [0.27, 0.73],
              ].map(([x, y]) => (
                <div
                  key={`${x}${y}`}
                  style={{
                    position: 'absolute',
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    width: bodyW * 0.15,
                    height: bodyW * 0.15,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 999,
                    background: 'radial-gradient(circle at 35% 35%, #4a4a58 0%, #0b0b10 55%, #000 100%)',
                    boxShadow: '0 0 0 3px #2a2a2e, 0 0 0 5px rgba(255,255,255,0.05)',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                opacity: 0.9,
              }}
            >
              <WalletIcon size={bodyW * 0.16} />
            </div>
          </div>

          {/* Frente: moldura + ecrã. */}
          <div
            style={{
              ...face,
              transform: `translateZ(${thickness / 2 + 0.5}px)`,
              padding: bezel,
              // A moldura também apanha a luz: o lado claro muda com o ângulo.
              background: `linear-gradient(${bezelLight}deg, #4a4a4e, #1c1c1e 55%, #2c2c30)`,
              boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.1)',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: screenW,
                height: screenH,
                borderRadius: screenW * 0.13,
                overflow: 'hidden',
                background: '#171717',
              }}
            >
              <StatusBar scale={k} />
              <div style={{ position: 'absolute', left: 0, right: 0, top: STATUS_H * k, height: CAPTURE_H * k }}>
                <Screens scheme={scheme} />
                <PushNotification scale={k} />
                <Taps scale={k} />
              </div>
              {/* Indicador "home" */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 8 * k,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 134 * k,
                  height: 5 * k,
                  borderRadius: 999,
                  background: 'rgba(250,250,250,0.85)',
                }}
              />
              {/* Dynamic Island */}
              <div
                style={{
                  position: 'absolute',
                  top: screenW * 0.025,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: screenW * 0.3,
                  height: screenW * 0.085,
                  borderRadius: 999,
                  background: '#000',
                }}
              />
              {/* Reflexo no vidro: faixa inclinada + brilho difuso, os dois a seguir a luz. */}
              <div
                style={{
                  position: 'absolute',
                  top: -screenH * 0.2,
                  height: screenH * 1.4,
                  left: glareX - screenW * 0.35,
                  width: screenW * 0.7,
                  pointerEvents: 'none',
                  transform: 'skewX(-20deg)',
                  background: `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,${glareStrength * 0.35}) 30%, rgba(255,255,255,${glareStrength}) 48%, rgba(255,255,255,${glareStrength * 0.25}) 62%, rgba(255,255,255,0) 100%)`,
                  mixBlendMode: 'screen',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: `radial-gradient(ellipse ${screenW * 0.9}px ${screenH * 0.45}px at ${glareX}px ${glareY}px, rgba(255,255,255,${glareStrength * 0.25}), rgba(255,255,255,0) 70%)`,
                  mixBlendMode: 'screen',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const StatusBar = ({ scale }: { scale: number }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      height: STATUS_H * scale,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${6 * scale}px ${30 * scale}px 0`,
      fontSize: 16 * scale,
      fontWeight: 600,
      color: '#fafafa',
    }}
  >
    <span>9:41</span>
    <svg width={64 * scale} height={14 * scale} viewBox="0 0 64 14" fill="#fafafa">
      {/* rede */}
      <rect x="0" y="9" width="3" height="5" rx="1" />
      <rect x="5" y="6" width="3" height="8" rx="1" />
      <rect x="10" y="3" width="3" height="11" rx="1" />
      <rect x="15" y="0" width="3" height="14" rx="1" />
      {/* bateria */}
      <rect x="34" y="1" width="25" height="12" rx="3.5" fill="none" stroke="#fafafa" strokeOpacity="0.5" />
      <rect x="36" y="3" width="18" height="8" rx="2" />
      <rect x="60.5" y="5" width="2" height="4" rx="1" fillOpacity="0.5" />
    </svg>
  </div>
)

const Screens = ({ scheme }: { scheme: string }) => {
  const frame = useCurrentFrame()
  const current = SCREENS.findLastIndex((s) => frame >= s.from)
  const visible = SCREENS.slice(Math.max(0, current - 1), current + 1)
  return (
    <>
      {visible.map((screen) => (
        <Img
          key={`${screen.from}-${screen.src}`}
          src={staticFile(`captures/${scheme}/${screen.src}.png`)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: interpolate(frame, [screen.from, screen.from + 8], [0, 1], clamp),
          }}
        />
      ))}
    </>
  )
}

// Banner de notificação ao estilo iOS: cai do topo com mola, fica e recolhe.
const PushNotification = ({ scale }: { scale: number }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  if (frame < NOTIFICATION.from - 2 || frame > NOTIFICATION.to + 12) return null
  const drop = spring({ frame: frame - NOTIFICATION.from, fps, config: { damping: 16, stiffness: 140 } })
  const lift = interpolate(frame, [NOTIFICATION.to, NOTIFICATION.to + 10], [0, 1], { ...clamp, easing: easeInOut })
  const y = (1 - drop) * -120 - lift * 40
  return (
    <div
      style={{
        position: 'absolute',
        left: 10 * scale,
        right: 10 * scale,
        top: 8 * scale,
        transform: `translateY(${y * scale}px) scale(${1 - lift * 0.06})`,
        opacity: Math.min(1, drop * 1.4) * (1 - lift),
        display: 'flex',
        gap: 10 * scale,
        alignItems: 'flex-start',
        padding: `${11 * scale}px ${13 * scale}px`,
        borderRadius: 22 * scale,
        background: 'rgba(58,58,60,0.86)',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 ${10 * scale}px ${30 * scale}px rgba(0,0,0,0.45)`,
        color: '#fafafa',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 38 * scale,
          height: 38 * scale,
          borderRadius: 9 * scale,
          background: '#111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WalletIcon size={22 * scale} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 * scale, fontWeight: 600 }}>
          <span>{NOTIFICATION.title}</span>
          <span style={{ fontWeight: 400, color: 'rgba(250,250,250,0.55)', fontSize: 12.5 * scale }}>agora</span>
        </div>
        <div style={{ fontSize: 13.5 * scale, lineHeight: 1.3, marginTop: 2 * scale, color: 'rgba(250,250,250,0.9)' }}>
          {NOTIFICATION.body}
        </div>
      </div>
    </div>
  )
}

// Etiqueta "de quem é este telemóvel" na cena dos amigos ligados: troca com o ecrã.
const PhoneOwner = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // Dentro da Sequence o frame é relativo: converte para o frame absoluto do vídeo.
  const absolute = frame + SCENES.sync.from
  const current = SCREENS[SCREENS.findLastIndex((sc) => absolute >= sc.from)]
  const rita = isRitaScreen(current.src)
  const switchAt = SCREENS.find((sc) => isRitaScreen(sc.src))!.from - SCENES.sync.from
  const pop = spring({ frame: frame - (rita ? switchAt : 30), fps, config: { damping: 14, stiffness: 160 } })
  return (
    <div style={{ marginTop: 36, opacity: interpolate(frame, [30, 42], [0, 1], clamp) }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 22px',
          borderRadius: 999,
          border: `1px solid ${rita ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.18)'}`,
          background: rita ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
          fontSize: 28,
          fontWeight: 600,
          color: rita ? GREEN : '#d4d4d4',
          transform: `scale(${0.92 + pop * 0.08})`,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 99, background: rita ? GREEN : '#a3a3a3' }} />
        {rita ? 'Telemóvel da Rita' : 'Telemóvel da Sofia'}
      </span>
    </div>
  )
}

// Indicador de toque: ponto que aparece, pressiona e se expande em anel.
const Taps = ({ scale }: { scale: number }) => {
  const frame = useCurrentFrame()
  return (
    <>
      {TAPS.map((tap) => {
        const t = frame - tap.at
        if (t < -10 || t > 22) return null
        const dot = interpolate(t, [-10, -2, 0, 4, 14], [0, 1, 0.82, 1, 0], clamp)
        const ring = interpolate(t, [0, 20], [0.6, 2.4], { ...clamp, easing: easeOut })
        const ringOpacity = interpolate(t, [0, 20], [0.7, 0], clamp)
        const size = 44 * scale
        const base = {
          position: 'absolute' as const,
          left: tap.x * scale - size / 2,
          top: tap.y * scale - size / 2,
          width: size,
          height: size,
          borderRadius: 999,
        }
        return (
          <div key={tap.at}>
            <div style={{ ...base, background: 'rgba(255,255,255,0.35)', opacity: dot, transform: `scale(${dot})` }} />
            <div
              style={{
                ...base,
                border: `${2 * scale}px solid rgba(255,255,255,0.8)`,
                opacity: ringOpacity,
                transform: `scale(${ring})`,
              }}
            />
          </div>
        )
      })}
    </>
  )
}

// --- Texto -------------------------------------------------------------------

const RevealLine = ({
  children,
  delay,
  size,
  weight,
  color = '#fafafa',
}: {
  children: React.ReactNode
  delay: number
  size: number
  weight: number
  color?: string
}) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [delay, delay + 20], [0, 1], { ...clamp, easing: easeOut })
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.12,
        letterSpacing: size > 50 ? '-0.035em' : '-0.01em',
        textWrap: 'balance',
        color,
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
        filter: `blur(${(1 - p) * 6}px)`,
      }}
    >
      {children}
    </div>
  )
}

const Caption = ({
  vertical,
  phoneSide,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  vertical: boolean
  phoneSide: number
  eyebrow: string
  title: string
  subtitle: string
  children?: React.ReactNode
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp)
  const layout: React.CSSProperties = vertical
    ? { left: 90, right: 90, top: 120, textAlign: 'center' }
    : { [phoneSide > 0 ? 'left' : 'right']: 150, width: 820, top: '50%', transform: 'translateY(-50%)' }
  return (
    <div style={{ position: 'absolute', ...layout, opacity: exit }}>
      <RevealLine delay={6} size={26} weight={600} color={GREEN}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>{eyebrow}</span>
      </RevealLine>
      <div style={{ height: 22 }} />
      <RevealLine delay={12} size={vertical ? 78 : 84} weight={600}>
        {title}
      </RevealLine>
      <div style={{ height: 28 }} />
      <RevealLine delay={22} size={36} weight={400} color="#a3a3a3">
        <span style={{ lineHeight: 1.4, display: 'block' }}>{subtitle}</span>
      </RevealLine>
      {children}
    </div>
  )
}

// --- Cena final ----------------------------------------------------------------

const WalletIcon = ({ size }: { size: number }) => (
  // Ícone "wallet" do lucide (o mesmo do cabeçalho da app).
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </svg>
)

const CtaScene = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const logo = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 120 } })
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          transform: `scale(${0.85 + logo * 0.15})`,
          opacity: logo,
          marginBottom: 56,
        }}
      >
        <WalletIcon size={64} />
        <span style={{ fontSize: 56, fontWeight: 600, letterSpacing: '-0.03em' }}>FinancasApp</span>
      </div>
      <RevealLine delay={24} size={80} weight={600}>
        Contas com amigos, finalmente certas.
      </RevealLine>
      <div style={{ height: 18 }} />
      <RevealLine delay={36} size={44} weight={400} color="#a3a3a3">
        O teu dinheiro e o que te devem, num só sítio.
      </RevealLine>
      <div style={{ height: 64 }} />
      <RevealLine delay={56} size={28} weight={600} color={GREEN}>
        <span style={{ letterSpacing: '0.04em' }}>Instala em segundos · Sem App Store</span>
      </RevealLine>
    </AbsoluteFill>
  )
}

// --- Som ---------------------------------------------------------------------

// Momentos de "recompensa": a música baixa um pouco para o efeito brilhar.
const DUCKS = SFX.filter((fx) => fx.src === 'coin' || fx.src === 'success' || fx.src === 'notify').map((fx) => fx.at)

const SoundDesign = ({ music }: { music: string }) => {
  const { durationInFrames } = useVideoConfig()
  const transitions = [SCENES.split.from, SCENES.cta.from]
  const musicVolume = (f: number) => {
    const fade = interpolate(f, [0, 20, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], clamp)
    const duck = DUCKS.reduce((v, at) => Math.min(v, interpolate(f, [at - 3, at, at + 18, at + 30], [1, 0.55, 0.55, 1], clamp)), 1)
    return 0.42 * fade * duck
  }
  return (
    <>
      {music && <Audio src={staticFile(music)} volume={musicVolume} />}
      {transitions.map((at) => (
        <Sequence key={`w${at}`} from={at - 6} durationInFrames={20}>
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.4} />
        </Sequence>
      ))}
      {/* Bolhas do problema: um pop por bolha, a acompanhar o aparecer. */}
      {SCATTERED.map((chip) => (
        <Sequence key={`p${chip.d}`} from={chip.d + 3} durationInFrames={10}>
          <Audio src={staticFile('sfx/pop.wav')} volume={0.35} playbackRate={0.9 + chip.d / 60} />
        </Sequence>
      ))}
      {SFX.map((fx) => (
        <Sequence key={`fx${fx.at}${fx.src}`} from={fx.at} durationInFrames={60}>
          <Audio src={staticFile(`sfx/${fx.src}.wav`)} volume={fx.volume} />
        </Sequence>
      ))}
      {TAPS.map((tap) => (
        <Sequence key={`t${tap.at}`} from={tap.at} durationInFrames={6}>
          <Audio src={staticFile('sfx/tap.wav')} volume={0.6} />
        </Sequence>
      ))}
    </>
  )
}
