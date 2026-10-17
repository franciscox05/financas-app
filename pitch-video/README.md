# Vídeo de pitch (30s)

Montado em [Remotion](https://www.remotion.dev/) a partir de capturas reais da app, feitas com Playwright usando uma conta demo com dados fictícios.

## Gerar o vídeo

```bash
cd pitch-video
npm install

# 1. Conta demo (só da primeira vez, ou para repor os dados):
#    correr seed-demo.sql no SQL Editor do Supabase, trocando __DEMO_PASSWORD__.
#    Guardar as credenciais em .env.demo (DEMO_EMAIL=..., DEMO_PASSWORD=...).

# 2. Capturas (com a app a correr: npx vite --port 5199 na raiz do repo)
npm run capture

# 3. Vídeo
npm run studio            # pré-visualizar/editar ao vivo
npm run render            # out/pitch-16x9.mp4 (apresentação)
npm run render:vertical   # out/pitch-9x16.mp4 (reels/stories/shorts)
```

Música (opcional): colocar um MP3 sem direitos de autor em `public/music.mp3` e acrescentar `--props='{"music":"music.mp3"}'` ao comando de render.

## Onde mexer

- `src/timeline.ts`: duração das cenas, troca de ecrãs, toques e zoom.
- `src/Pitch.tsx`: textos, layout e animações.
- O seed usa datas pensadas para 14/10/2026. Se o pitch for noutra data, ajustar `due_on` das dívidas para manter "2 atrasadas, 1 a vencer".
