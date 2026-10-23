# Vídeo de pitch (~41s)

Montado em [Remotion](https://www.remotion.dev/) a partir de capturas reais da app, feitas com Playwright usando duas contas demo com dados fictícios: a Sofia (protagonista) e a Rita, uma amiga **ligada** à Sofia.

História: a Sofia paga o sushi e divide por quatro → chega uma notificação ao telemóvel da Rita → a Rita aceita → saldos de todos os amigos → património → modo privacidade.

## Gerar o vídeo

```bash
cd pitch-video
npm install

# 1. Contas demo (repor antes de cada captura — a captura aceita o sushi do lado da Rita):
#    correr seed-demo.sql no SQL Editor do Supabase. Reaproveita a password atual
#    da Sofia para as duas contas; só na primeira vez é preciso trocar __DEMO_PASSWORD__.
#    Credenciais em .env.demo (DEMO_EMAIL=..., DEMO_PASSWORD=...). A Rita é
#    demo-rita@financasapp.com, com a mesma password.

# 2. Capturas (com a app a correr: npx vite --port 5199 na raiz do repo)
npm run capture

# 3. Vídeo
npm run studio            # pré-visualizar/editar ao vivo
npm run render            # out/pitch-16x9.mp4 (apresentação) + out/pitch-16x9-discord.mp4
npm run render:vertical   # out/pitch-9x16.mp4 (reels/stories/shorts) + out/pitch-9x16-discord.mp4
```

O render é feito ao dobro da resolução (`--scale=2`, em `out/raw/`) e o `master.mjs` reduz para 1080p com lanczos: sem este supersampling, o ecrã da app dentro do telemóvel 3D fica desfocado. O mesmo passo normaliza o volume para ~-14 LUFS (Reels/TikTok) e gera a versão `-discord` (<10 MB). Precisa de **ffmpeg** no PATH. Cada render demora uns minutos (4K).

Som: os efeitos (`public/sfx/`) e a faixa de fundo (`public/music/groove.wav`, 120 BPM com drop aos 5s) são sintetizados por `sfx-gen.mjs` — originais, sem direitos de autor. Os comandos de render correm `npm run sfx` antes. Para usar outra música: `--props='{"music":"music.mp3"}'` (ficheiro em `public/`); sem música: `--props='{"music":""}'`.
## Onde mexer

- `src/timeline.ts`: duração das cenas, troca de ecrãs, toques, zoom, ângulos 3D (`ORBIT`), a volta de 360° (`SPIN`), efeitos sonoros (`SFX`) e o texto da notificação (igual ao do trigger `ledger_entries_push`).
- `src/Pitch.tsx`: textos, layout e animações; o telemóvel 3D (frente, costas, aro, reflexo que segue o ângulo e a velocidade) está em `PhoneStage`/`phonePose`.
- O seed usa datas pensadas para 23/10/2026. Se o pitch for noutra data, ajustar os `due_on` do João e do Miguel (atrasados) e a data do sushi ("ontem").
