# Escola_3D — Explorador de Escola Virtual Brasileira 3D

Aplicação 100% browser (Vite + React + TypeScript + three.js via @react-three/fiber
e drei + Zustand, sem backend). Site publicado no GitHub Pages:
https://tarikdsm.github.io/Escola_3D/

## Regras permanentes do projeto

- **Sempre commitar E dar push após qualquer mudança** (implementação, correção,
  atualização, configuração — qualquer alteração de código ou docs). Não é preciso
  pedir confirmação: o usuário autorizou commit + push automáticos. O push para a
  branch `main` dispara o workflow `.github/workflows/deploy.yml`, que republica
  o GitHub Pages automaticamente — após o push, acompanhar o run e confirmar o
  deploy (`gh run watch <id> --exit-status` + curl no site).

## Comandos

- `npm run dev` — desenvolvimento (http://localhost:5173)
- `npm run build` — typecheck + build de produção
- `npm run preview` — serve o build localmente
- `npx tsc --noEmit` — typecheck rápido

## Convenções

- `src/contracts/` é a fonte única da verdade (layout, waypoints, buffers, roster);
  mudanças nele impactam todas as frentes — evite, e documente quando inevitável.
- Nada de assets externos: geometrias, texturas (CanvasTexture) e sons (WebAudio)
  são 100% procedurais.
- Strings visíveis ao usuário e comentários em PT-BR.
- Performance: posições/animações dos 79 personagens vivem em buffers fora do
  React (`SIM`); nada de setState por frame; instancing para geometria repetida.
