import { loadFont } from '@remotion/google-fonts/Inter'
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { CAMERA, SCENES, SCREENS, TAPS } from './timeline'

const { fontFamily } = loadFont('normal', { weights: ['400', '600'], subsets: ['latin', 'latin-ext'] })

export const pitchSchemaDefaults = { vertical: false, scheme: 'dark', music: '' }
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

export const Pitch = ({ vertical, scheme, music }: Props) => (
  <AbsoluteFill style={{ backgroundColor: '#0a0a0b', fontFamily, color: '#fafafa' }}>
    <Backdrop vertical={vertical} />

    <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration}>
      <ProblemScene vertical={vertical} />
    </Sequence>

    <PhoneStage vertical={vertical} scheme={scheme} />

    <Sequence from={SCENES.networth.from} durationInFrames={SCENES.networth.duration}>
      <Caption
        vertical={vertical}
        eyebrow="Património"
        title="Tudo num só sítio."
        subtitle="Cada conta, cada movimento, mês a mês."
      />
    </Sequence>
    <Sequence from={SCENES.debts.from} durationInFrames={SCENES.debts.duration}>
      <Caption
        vertical={vertical}
        eyebrow="Dívidas"
        title="Quem te deve, quanto falta."
        subtitle="Pagamentos parciais, aviso quando atrasa. Enganaste-te? Anula."
      />
    </Sequence>
    <Sequence from={SCENES.privacy.from} durationInFrames={SCENES.privacy.duration}>
      <Caption
        vertical={vertical}
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

// Fundo escuro com um brilho verde suave que acompanha o telemóvel.
const Backdrop = ({ vertical }: { vertical: boolean }) => {
  const frame = useCurrentFrame()
  const glow = interpolate(frame, [SCENES.networth.from - 10, SCENES.networth.from + 30], [0.35, 1], clamp)
  const position = vertical ? '50% 68%' : '70% 50%'
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${position}, rgba(34,197,94,${0.16 * glow}) 0%, rgba(34,197,94,0) 45%)`,
      }}
    />
  )
}

// --- Cena 1: o problema -------------------------------------------------------

// Posições em fração de meia largura/altura, para servir 16:9 e 9:16.
const SCATTERED = [
  { label: 'App do banco', x: -0.62, y: -0.56, d: 0 },
  { label: 'XTB', x: 0.6, y: -0.62, d: 4 },
  { label: 'Trade Republic', x: -0.58, y: 0.46, d: 8 },
  { label: 'Excel de 2023', x: 0.56, y: 0.52, d: 12 },
  { label: '"A Rita deve-me 30€?"', x: -0.08, y: 0.72, d: 16 },
  { label: 'Notas do telemóvel', x: 0.12, y: -0.76, d: 20 },
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
          O teu dinheiro está em 4 apps.
        </RevealLine>
        <RevealLine delay={50} size={vertical ? 76 : 72} weight={600} color="#737373">
          As dívidas dos amigos, em lado nenhum.
        </RevealLine>
      </div>
    </AbsoluteFill>
  )
}

// --- Telemóvel ---------------------------------------------------------------

const PhoneStage = ({ vertical, scheme }: { vertical: boolean; scheme: string }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const start = SCENES.networth.from
  const end = SCENES.cta.from

  if (frame < start - 2 || frame > end + 20) return null

  const enter = spring({ frame: frame - start, fps, config: { damping: 200, mass: 0.9 } })
  const leave = interpolate(frame, [end - 4, end + 16], [0, 1], { ...clamp, easing: easeInOut })

  // Câmara: interpolação entre keyframes, com easing em cada troço.
  const at = CAMERA.map((k) => k.at)
  // Em vertical o telemóvel já ocupa a largura toda: sem zoom, senão tapa o texto.
  const zoom = vertical ? 1 : interpolate(frame, at, CAMERA.map((k) => k.zoom), { ...clamp, easing: easeInOut })
  const focusY = vertical ? 0.5 : interpolate(frame, at, CAMERA.map((k) => k.focusY), { ...clamp, easing: easeInOut })

  const screenW = vertical ? 540 : 380
  const k = screenW / CAPTURE_W
  const screenH = (CAPTURE_H + STATUS_H) * k
  const bezel = screenW * 0.035
  const offsetY = (0.5 - focusY) * screenH * zoom

  const left = vertical ? '50%' : '70%'
  const top = vertical ? '62%' : '50%'

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        transform: `translate(-50%, -50%) translateX(${(1 - enter) * 260}px) translateY(${offsetY + leave * 60}px) scale(${zoom * (1 - leave * 0.08)})`,
        opacity: enter * (1 - leave),
      }}
    >
      <div
        style={{
          padding: bezel,
          borderRadius: screenW * 0.16,
          background: 'linear-gradient(145deg, #3a3a3c, #1c1c1e)',
          boxShadow: '0 60px 120px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.08)',
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
            <Taps scale={k} />
          </div>
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
  eyebrow,
  title,
  subtitle,
}: {
  vertical: boolean
  eyebrow: string
  title: string
  subtitle: string
}) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp)
  const layout: React.CSSProperties = vertical
    ? { left: 90, right: 90, top: 150, textAlign: 'center' }
    : { left: 150, width: 820, top: '50%', transform: 'translateY(-50%)' }
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
        O controlo total do teu dinheiro.
      </RevealLine>
      <div style={{ height: 18 }} />
      <RevealLine delay={36} size={44} weight={400} color="#a3a3a3">
        Simples, privado e sem atritos.
      </RevealLine>
      <div style={{ height: 64 }} />
      <RevealLine delay={56} size={28} weight={600} color={GREEN}>
        <span style={{ letterSpacing: '0.04em' }}>Instala em segundos · Sem App Store</span>
      </RevealLine>
    </AbsoluteFill>
  )
}

// --- Som ---------------------------------------------------------------------

const SoundDesign = ({ music }: { music: string }) => {
  const { durationInFrames } = useVideoConfig()
  const transitions = [SCENES.networth.from, SCENES.cta.from]
  return (
    <>
      {music && (
        <Audio
          src={staticFile(music)}
          volume={(f) =>
            interpolate(f, [0, 20, durationInFrames - 45, durationInFrames], [0, 0.55, 0.55, 0], clamp)
          }
        />
      )}
      {transitions.map((at) => (
        <Sequence key={`w${at}`} from={at - 6} durationInFrames={20}>
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.5} />
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
