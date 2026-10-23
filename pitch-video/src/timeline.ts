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

// Lado do ecrã onde fica o telemóvel em cada cena (1 = direita, -1 = esquerda); a legenda
// vai para o lado oposto. Na troca de cena desliza enquanto as legendas saem e entram.
export const PHONE_SIDE = { split: 1, sync: -1, friends: 1, networth: -1, privacy: -1 } as const
const SIDE_ORDER = ['split', 'sync', 'friends', 'networth', 'privacy'] as const
export const SIDE_KEYS: { at: number; side: number }[] = SIDE_ORDER.flatMap((scene, i) => {
  const { from } = SCENES[scene]
  const side = PHONE_SIDE[scene]
  if (i === 0) return [{ at: from, side }]
  return [
    { at: from - 12, side: PHONE_SIDE[SIDE_ORDER[i - 1]] },
    { at: from + 12, side },
  ]
})

// Volta de 360° do telemóvel na troca Sofia → Rita: o ecrã troca enquanto se vêem as
// costas (entre os 90° e os 270°), por isso a troca de captura cai a meio da volta.
export const SPIN = { from: s(15.4), to: s(16.8) }

// Ecrã mostrado no telemóvel a partir de cada frame (crossfade entre eles).
// "rita-*" são capturas da conta da Rita: o telemóvel passa a ser o dela.
export const SCREENS: { from: number; src: string }[] = [
  { from: 0, src: 'dividir' },
  { from: s(9.3), src: 'dividir-igual' },
  { from: s(13), src: 'amigo-rita' },
  { from: s(16), src: 'rita-amigos' },
  { from: s(18.9), src: 'rita-sofia' },
  { from: s(21.1), src: 'rita-sofia-aceite' },
  { from: s(23), src: 'amigos' },
  { from: s(28), src: 'patrimonio' },
  { from: s(34.1), src: 'patrimonio-privado' },
]

export const isRitaScreen = (src: string) => src.startsWith('rita-')

// Toques no ecrã: posição em pixéis CSS da captura (viewport 390x844).
export const TAPS: { at: number; x: number; y: number }[] = [
  { at: s(9), x: 236, y: 537 }, // "Dividir por igual"
  { at: s(18.5), x: 195, y: 62 }, // notificação push (abre o movimento)
  { at: s(20.8), x: 51, y: 524 }, // "Aceitar"
  { at: s(33.8), x: 316, y: 52 }, // olho do modo privacidade
]

// Notificação push no telemóvel da Rita — mesmo texto que o trigger ledger_entries_push envia.
export const NOTIFICATION = {
  from: s(17),
  to: s(18.7),
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
  { at: SPIN.from, src: 'riser', volume: 0.25 }, // volta do telemóvel
  { at: SPIN.from + 8, src: 'swish', volume: 0.55 },
  { at: SPIN.to - 10, src: 'swish', volume: 0.4 },
  { at: NOTIFICATION.from + 4, src: 'notify', volume: 0.8 },
  { at: s(21.1), src: 'success', volume: 0.75 }, // movimento aceite
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
  { at: s(16.9), zoom: 1, focusY: 0.5 },
  { at: s(17.5), zoom: 1.4, focusY: 0.14 }, // notificação a cair
  { at: s(18.5), zoom: 1.4, focusY: 0.14 },
  { at: s(19.1), zoom: 1, focusY: 0.5 },
  { at: s(19.6), zoom: 1.4, focusY: 0.56 }, // "Está certo?" Aceitar / Contestar
  { at: s(22), zoom: 1.4, focusY: 0.56 },
  { at: s(22.6), zoom: 1, focusY: 0.5 },
]

// Ângulo do telemóvel em 3D (graus): rotY > 0 vira o ecrã para a direita, rotX > 0
// inclina o topo para trás. Vai de um lado para o outro entre cenas, como nos anúncios
// de fintech, sempre virado para o centro (acompanha PHONE_SIDE); fica de frente nos
// zooms, para o texto da app se ler.
export const ORBIT: { at: number; y: number; x: number }[] = [
  { at: s(5), y: -16, x: 7 }, // hero: 3/4 depois da entrada
  { at: s(8.6), y: -6, x: 3 },
  { at: s(9.6), y: 0, x: 0 },
  { at: s(12.3), y: 0, x: 0 },
  { at: s(13.2), y: 14, x: 5 }, // conta-corrente da Rita, do outro lado
  { at: s(15.2), y: 8, x: 3 },
  { at: s(16.9), y: -4, x: 2 },
  { at: s(17.4), y: 0, x: 0 },
  { at: s(22), y: 0, x: 0 },
  { at: s(23.4), y: -20, x: 7 }, // saldos dos amigos
  { at: s(27.4), y: -10, x: 4 },
  { at: s(28.6), y: 20, x: 7 }, // património, para o outro lado
  { at: s(32.6), y: 10, x: 4 },
  { at: s(33.6), y: 0, x: 1 }, // de frente para o toque no olho
  { at: s(36), y: -8, x: 3 },
]
