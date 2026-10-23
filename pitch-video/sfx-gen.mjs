// Gera os efeitos sonoros e a faixa de fundo por síntese (sem samples nem direitos de
// autor). Uso: `npm run sfx` — escreve em public/sfx/*.wav e public/music/groove.wav.
// A faixa segue a timeline do vídeo: intro filtrada até ao "drop" aos 5s (entra o
// telemóvel), groove a 120 BPM (1 batida = 15 frames) e acorde final no CTA.
import { mkdirSync, writeFileSync } from 'node:fs'

const SR = 44100
const TAU = Math.PI * 2

function writeWav(path, samples) {
  let peak = 0
  for (const v of samples) peak = Math.max(peak, Math.abs(v))
  const gain = peak > 0 ? 0.89 / peak : 1
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), 44 + i * 2))
  writeFileSync(path, buf)
  console.log('som', path, `${(samples.length / SR).toFixed(2)}s`)
}

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * SR))
const noise = () => Math.random() * 2 - 1
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay))

// Filtro de estado variável (2 polos) com corte variável no tempo.
function svf(input, cutoffAt, q = 0.7, mode = 'low') {
  const out = new Float32Array(input.length)
  let low = 0
  let band = 0
  for (let i = 0; i < input.length; i++) {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoffAt(i / SR), SR / 6)) / SR)
    low += f * band
    const high = input[i] - low - band / q
    band += f * high
    out[i] = mode === 'low' ? low : mode === 'high' ? high : band
  }
  return out
}

// Sino suave: fundamental + parciais inarmónicos que decaem mais depressa.
function bell(out, at, freq, amp, decay = 0.45) {
  const start = Math.floor(at * SR)
  const partials = [[1, 1], [2.01, 0.35], [3.98, 0.12], [5.43, 0.05]]
  for (let i = 0; start + i < out.length && i < SR * decay * 7; i++) {
    const t = i / SR
    let v = 0
    for (const [ratio, a] of partials) v += a * Math.sin(TAU * freq * ratio * t) * Math.exp(-t / (decay / ratio ** 0.6))
    out[start + i] += amp * v * Math.min(1, t / 0.002)
  }
}

// Pop: seno com queda rápida de tom (bolha a rebentar).
function pop(out, at, f0, f1, amp, len = 0.09) {
  const start = Math.floor(at * SR)
  let phase = 0
  for (let i = 0; start + i < out.length && i < len * SR; i++) {
    const t = i / SR
    phase += (TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.018))) / SR
    out[start + i] += amp * Math.sin(phase) * env(t, 0.0015, len / 4)
  }
}

function kick(out, at, amp = 1, len = 0.38) {
  const start = Math.floor(at * SR)
  let phase = 0
  for (let i = 0; start + i < out.length && i < len * SR; i++) {
    const t = i / SR
    phase += (TAU * (45 + 110 * Math.exp(-t / 0.035))) / SR
    out[start + i] += amp * Math.tanh(1.6 * Math.sin(phase)) * env(t, 0.002, len / 3.2)
  }
}

function noiseHit(out, at, amp, len, cutoff, mode = 'high', q = 0.7) {
  const n = Math.floor(len * SR)
  const raw = new Float32Array(n).map((_, i) => noise() * env(i / SR, 0.001, len / 4))
  const filtered = svf(raw, () => cutoff, q, mode)
  const start = Math.floor(at * SR)
  for (let i = 0; i < n && start + i < out.length; i++) out[start + i] += amp * filtered[i]
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12)

mkdirSync('public/sfx', { recursive: true })
mkdirSync('public/music', { recursive: true })

// --- Efeitos -----------------------------------------------------------------------

{ // pop: bolhas do problema a aparecer
  const o = buffer(0.12)
  pop(o, 0, 1100, 380, 1)
  writeWav('public/sfx/pop.wav', o)
}

{ // impact: corte do caos para o telemóvel (sub + estalo + cauda)
  const o = buffer(1.4)
  kick(o, 0, 1, 1.1)
  noiseHit(o, 0, 0.5, 0.08, 2500, 'high')
  const tail = svf(Float32Array.from({ length: o.length }, (_, i) => noise() * Math.exp(-i / SR / 0.35)), () => 900, 0.8, 'low')
  tail.forEach((v, i) => (o[i] += 0.25 * v))
  writeWav('public/sfx/impact.wav', o)
}

{ // riser: tensão antes do drop (ruído a abrir + tom a subir)
  const len = 1.3
  const o = buffer(len)
  const raw = Float32Array.from(o, () => noise())
  const swept = svf(raw, (t) => 300 + 7000 * (t / len) ** 2, 3, 'band')
  let phase = 0
  for (let i = 0; i < o.length; i++) {
    const t = i / SR
    const rise = (t / len) ** 1.6
    phase += (TAU * (220 + 660 * rise)) / SR
    o[i] = (0.55 * swept[i] + 0.25 * Math.sin(phase)) * rise * Math.min(1, (len - t) / 0.02)
  }
  writeWav('public/sfx/riser.wav', o)
}

{ // coin: "ka-ching" moderno ao dividir — dois sinos brilhantes + brilho
  const o = buffer(1.2)
  noiseHit(o, 0, 0.35, 0.03, 6000, 'high')
  bell(o, 0.0, midi(83), 0.7, 0.22) // B5
  bell(o, 0.075, midi(88), 0.9, 0.5) // E6
  for (let k = 0; k < 6; k++) bell(o, 0.1 + k * 0.035, midi(95 + (k % 3) * 2), 0.12, 0.12)
  writeWav('public/sfx/coin.wav', o)
}

{ // share-1..3: pops afinados a subir, um por amigo que recebe os 15 €
  ;[76, 79, 83].forEach((note, i) => {
    const o = buffer(0.35)
    pop(o, 0, midi(note) * 1.6, midi(note), 0.8, 0.12)
    bell(o, 0, midi(note + 12), 0.25, 0.12)
    writeWav(`public/sfx/share-${i + 1}.wav`, o)
  })
}

{ // notify: ding original de duas notas (não é o som do iOS)
  const o = buffer(1.3)
  bell(o, 0, midi(81), 0.8, 0.35) // A5
  bell(o, 0.13, midi(88), 0.9, 0.55) // E6
  writeWav('public/sfx/notify.wav', o)
}

{ // success: arpejo maior a subir + brilho, quando a Rita aceita
  const o = buffer(1.6)
  ;[72, 76, 79, 84].forEach((n, i) => bell(o, i * 0.055, midi(n), 0.6 + i * 0.1, 0.5))
  for (let k = 0; k < 8; k++) bell(o, 0.22 + k * 0.03, midi(96 + (k % 4) * 3), 0.07, 0.1)
  writeWav('public/sfx/success.wav', o)
}

{ // toggle: obturador ao esconder valores (dois cliques + baque)
  const o = buffer(0.3)
  noiseHit(o, 0, 0.9, 0.025, 3500, 'band', 2)
  noiseHit(o, 0.045, 0.7, 0.03, 2200, 'band', 2)
  kick(o, 0.045, 0.35, 0.12)
  writeWav('public/sfx/toggle.wav', o)
}

{ // swish: transição leve entre ecrãs (mais curto que o whoosh)
  const len = 0.35
  const o = buffer(len)
  const raw = Float32Array.from(o, () => noise())
  const swept = svf(raw, (t) => 600 + 5000 * Math.sin((Math.PI * t) / len), 1.5, 'band')
  for (let i = 0; i < o.length; i++) o[i] = swept[i] * Math.sin((Math.PI * i) / o.length) ** 2
  writeWav('public/sfx/swish.wav', o)
}

// --- Faixa de fundo ---------------------------------------------------------------

{
  const BPM = 120
  const beat = 60 / BPM // 0.5s = 15 frames
  const DROP = 5 // entra o telemóvel
  const CTA = 36
  const END = 41
  const o = buffer(END)
  const pad = new Float32Array(o.length)
  const pluck = new Float32Array(o.length)

  // Am – F – C – G, um acorde por compasso (2s).
  const chords = [
    [57, 60, 64, 69],
    [53, 57, 60, 65],
    [48, 55, 60, 64],
    [55, 59, 62, 67],
  ]
  const chordAt = (t) => chords[Math.floor(t / (beat * 4)) % chords.length]

  // Pad: dente de serra desafinado, depois filtrado (abre até ao drop).
  for (let i = 0; i < o.length; i++) {
    const t = i / SR
    const notes = t >= CTA ? [57, 60, 64, 69, 72] : chordAt(t)
    let v = 0
    for (const n of notes) for (const det of [-0.08, 0.08]) v += ((((midi(n) * (1 + det / 100)) * t) % 1) * 2 - 1) * 0.12
    pad[i] = v
  }
  const padFiltered = svf(pad, (t) => (t < DROP ? 250 + 1400 * (t / DROP) ** 2 : t < CTA ? 2200 : 2200 - 1700 * ((t - CTA) / (END - CTA))), 0.9, 'low')

  // Sidechain: o pad "respira" com o bombo depois do drop.
  const duck = (t) => {
    if (t < DROP || t >= CTA) return 1
    const phase = ((t - DROP) % beat) / beat
    return 0.35 + 0.65 * Math.min(1, phase * 3.2)
  }
  for (let i = 0; i < o.length; i++) {
    const t = i / SR
    const fadeOut = t > END - 2.5 ? Math.max(0, (END - t) / 2.5) : 1
    o[i] += padFiltered[i] * duck(t) * 0.55 * Math.min(1, t / 1.2) * fadeOut
  }

  // Bateria: hats a crescer na intro; depois bombo 4/4, palmas no 2 e 4, hats em contratempo.
  for (let b = 0; b * beat < CTA; b++) {
    const t = b * beat
    if (t < DROP) {
      if (t >= 1) noiseHit(o, t + beat / 2, 0.06 + 0.08 * (t / DROP), 0.04, 8000)
      continue
    }
    kick(o, t, 0.85)
    noiseHit(o, t + beat / 2, 0.16, 0.05, 8000)
    noiseHit(o, t + beat / 4 * 3, 0.06, 0.03, 9000)
    if (b % 2 === 1) noiseHit(o, t, 0.32, 0.14, 1600, 'band', 1.2)
  }
  // Fill de bateria antes de cada cena grande, para puxar a atenção.
  for (const at of [13, 23, 28, 33]) for (let k = 0; k < 4; k++) noiseHit(o, at - beat + (k * beat) / 4, 0.12 + k * 0.04, 0.06, 1800, 'band', 1.4)

  // Baixo em colcheias, seguindo a fundamental do acorde (só depois do drop).
  for (let s8 = 0; DROP + s8 * (beat / 2) < CTA; s8++) {
    const t = DROP + s8 * (beat / 2)
    if (s8 % 2 === 0) continue // contratempo: deixa espaço ao bombo
    const f = midi(chordAt(t)[0] - 12)
    const start = Math.floor(t * SR)
    for (let i = 0; i < 0.22 * SR; i++) {
      const tt = i / SR
      o[start + i] += 0.32 * Math.tanh(2 * Math.sin(TAU * f * tt)) * env(tt, 0.004, 0.07)
    }
  }

  // Arpejo "pluck" em semicolcheias: a parte que dá brilho e ritmo (só depois do drop).
  for (let s16 = 0; DROP + s16 * (beat / 4) < CTA; s16++) {
    const t = DROP + s16 * (beat / 4)
    const notes = chordAt(t)
    const n = notes[[0, 2, 1, 3, 2, 1, 3, 2][s16 % 8]] + 12
    const start = Math.floor(t * SR)
    for (let i = 0; i < 0.16 * SR; i++) {
      const tt = i / SR
      const saw = ((midi(n) * tt) % 1) * 2 - 1
      pluck[start + i] += 0.1 * (0.6 * saw + 0.4 * Math.sin(TAU * midi(n) * tt)) * env(tt, 0.002, 0.045)
    }
  }
  svf(pluck, () => 3200, 0.8, 'low').forEach((v, i) => (o[i] += v))

  // Final: bombo + sino grave no CTA, o acorde fica a soar até ao fim.
  kick(o, CTA, 1, 0.8)
  bell(o, CTA, midi(57), 0.35, 1.6)
  bell(o, CTA, midi(69), 0.25, 1.4)

  writeWav('public/music/groove.wav', o)
}
