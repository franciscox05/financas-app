// Masterização final com ffmpeg (tem de estar no PATH): o Remotion renderiza ao dobro da
// resolução (--scale=2) e aqui reduz-se para 1080p com lanczos — supersampling, para o
// ecrã da app dentro do telemóvel 3D ficar nítido. Também normaliza o volume para
// redes sociais (~-14 LUFS) e gera uma versão leve (<10 MB) para Discord/WhatsApp.
// Uso: node master.mjs pitch-16x9 1920:1080   (lê out/raw/<nome>.mp4)
import { execFileSync } from 'node:child_process'

const [name, size] = process.argv.slice(2)
if (!name || !size) throw new Error('Uso: node master.mjs <nome> <largura:altura>')

const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
const audio = ['-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000']
const video = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart']

ffmpeg(['-i', `out/raw/${name}.mp4`, '-vf', `scale=${size}:flags=lanczos`, ...video(16), ...audio, `out/${name}.mp4`])
ffmpeg(['-i', `out/${name}.mp4`, ...video(25), '-c:a', 'copy', `out/${name}-discord.mp4`])
console.log('pronto', `out/${name}.mp4`, `out/${name}-discord.mp4`)
