// Toda a temporização do vídeo num só sítio (frames a 30fps).
export const FPS = 30
const s = (seconds: number) => Math.round(seconds * FPS)

export const SCENES = {
  problem: { from: 0, duration: s(5) },
  networth: { from: s(5), duration: s(7) },
  debts: { from: s(12), duration: s(8) },
  privacy: { from: s(20), duration: s(5) },
  cta: { from: s(25), duration: s(5) },
}
export const DURATION = s(30)

// Ecrã mostrado no telemóvel a partir de cada frame (crossfade entre eles).
export const SCREENS: { from: number; src: string }[] = [
  { from: 0, src: 'patrimonio' },
  { from: s(8.6), src: 'conta-ordem' },
  { from: s(12), src: 'dividas' },
  { from: s(20), src: 'patrimonio' },
  { from: s(21.9), src: 'patrimonio-privado' },
]

// Toques no ecrã: posição em pixéis CSS da captura (viewport 390x844).
export const TAPS: { at: number; x: number; y: number }[] = [
  { at: s(8.1), x: 180, y: 193 }, // "Conta à Ordem"
  { at: s(17.6), x: 210, y: 466 }, // "Anular" no pagamento da Rita
  { at: s(21.5), x: 257, y: 31 }, // olho do modo privacidade
]

// "Câmara" sobre o telemóvel: zoom + foco (fração da altura do ecrã).
export const CAMERA: { at: number; zoom: number; focusY: number }[] = [
  { at: s(5), zoom: 1, focusY: 0.5 },
  { at: s(12), zoom: 1, focusY: 0.5 },
  { at: s(13.2), zoom: 1.45, focusY: 0.12 }, // aviso de dívidas atrasadas
  { at: s(15.4), zoom: 1.45, focusY: 0.12 },
  { at: s(16.4), zoom: 1.45, focusY: 0.52 }, // Rita: parcial + Anular
  { at: s(19.2), zoom: 1.45, focusY: 0.52 },
  { at: s(20), zoom: 1, focusY: 0.5 },
]
