// Toda a temporização do vídeo num só sítio (frames a 30fps).
export const FPS = 30
const s = (seconds: number) => Math.round(seconds * FPS)

export const SCENES = {
  problem: { from: 0, duration: s(5) },
  split: { from: s(5), duration: s(8) },
  sync: { from: s(13), duration: s(10) },
  friends: { from: s(23), duration: s(5) },
  networth: { from: s(28), duration: s(5) },
  privacy: { from: s(33), duration: s(3) },
  cta: { from: s(36), duration: s(5) },
}
export const DURATION = s(41)

// Ecrã mostrado no telemóvel a partir de cada frame (crossfade entre eles).
// "rita-*" são capturas da conta da Rita: o telemóvel passa a ser o dela.
export const SCREENS: { from: number; src: string }[] = [
  { from: 0, src: 'dividir' },
  { from: s(9.3), src: 'dividir-igual' },
  { from: s(13), src: 'amigo-rita' },
  { from: s(16), src: 'rita-amigos' },
  { from: s(18.3), src: 'rita-sofia' },
  { from: s(20.8), src: 'rita-sofia-aceite' },
  { from: s(23), src: 'amigos' },
  { from: s(28), src: 'patrimonio' },
  { from: s(34.1), src: 'patrimonio-privado' },
]

export const isRitaScreen = (src: string) => src.startsWith('rita-')

// Toques no ecrã: posição em pixéis CSS da captura (viewport 390x844).
export const TAPS: { at: number; x: number; y: number }[] = [
  { at: s(9), x: 236, y: 537 }, // "Dividir por igual"
  { at: s(17.9), x: 195, y: 62 }, // notificação push (abre o movimento)
  { at: s(20.5), x: 51, y: 524 }, // "Aceitar"
  { at: s(33.8), x: 316, y: 52 }, // olho do modo privacidade
]

// Notificação push no telemóvel da Rita — mesmo texto que o trigger ledger_entries_push envia.
export const NOTIFICATION = {
  from: s(16.4),
  to: s(18.1),
  title: 'Novo movimento',
  body: 'Sofia Martins registou um movimento contigo. Toca para confirmar.',
}

// Faixa de fundo (gerada por sfx-gen.mjs): 120 BPM, drop quando entra o telemóvel.
export const MUSIC_DROP = SCENES.split.from
export const BEAT_FRAMES = 15 // 0,5s a 30fps

// Efeitos sonoros, cada um no frame da ação que acompanha (ficheiros em public/sfx).
export const SFX: { at: number; src: string; volume: number }[] = [
  { at: s(3.7), src: 'riser', volume: 0.45 },
  { at: SCENES.split.from, src: 'impact', volume: 0.9 }, // caos → telemóvel
  { at: s(9.3), src: 'coin', volume: 0.75 }, // "Dividir por igual"
  { at: s(9.4), src: 'share-1', volume: 0.5 },
  { at: s(9.55), src: 'share-2', volume: 0.5 },
  { at: s(9.7), src: 'share-3', volume: 0.5 },
  { at: s(12.9), src: 'swish', volume: 0.5 },
  { at: s(15.9), src: 'swish', volume: 0.45 }, // passa para o telemóvel da Rita
  { at: NOTIFICATION.from + 4, src: 'notify', volume: 0.8 },
  { at: s(20.8), src: 'success', volume: 0.75 }, // movimento aceite
  { at: s(22.9), src: 'swish', volume: 0.5 },
  { at: s(27.9), src: 'swish', volume: 0.5 },
  { at: s(33.8), src: 'toggle', volume: 0.8 }, // esconder valores
  { at: SCENES.cta.from, src: 'impact', volume: 0.7 },
  { at: SCENES.cta.from + 10, src: 'success', volume: 0.45 }, // logo
]

// "Câmara" sobre o telemóvel: zoom + foco (fração da altura do ecrã).
export const CAMERA: { at: number; zoom: number; focusY: number }[] = [
  { at: s(5), zoom: 1, focusY: 0.5 },
  { at: s(9.6), zoom: 1, focusY: 0.5 },
  { at: s(10.4), zoom: 1.4, focusY: 0.55 }, // partes de 15 € e "Sobra para ti"
  { at: s(12.3), zoom: 1.4, focusY: 0.55 },
  { at: s(13), zoom: 1, focusY: 0.5 },
  { at: s(16.3), zoom: 1, focusY: 0.5 },
  { at: s(16.9), zoom: 1.4, focusY: 0.14 }, // notificação a cair
  { at: s(17.9), zoom: 1.4, focusY: 0.14 },
  { at: s(18.6), zoom: 1, focusY: 0.5 },
  { at: s(19.2), zoom: 1.4, focusY: 0.56 }, // "Está certo?" Aceitar / Contestar
  { at: s(21.6), zoom: 1.4, focusY: 0.56 },
  { at: s(22.4), zoom: 1, focusY: 0.5 },
]
