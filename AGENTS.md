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
  são 100% procedurais. **Exceção registrada**: o GLB local
  `public/models/maquina_fill_web.glb` (máquina Fill do almoxarifado) é asset
  mandatório do usuário — único arquivo não procedural do projeto.
- Strings visíveis ao usuário e comentários em PT-BR.
- Performance: posições/animações dos 712 personagens vivem em buffers fora do
  React (`SIM`); nada de setState por frame; instancing para geometria repetida
  (27 partes instanciadas de personagem, 640 carteiras, paredes, janelas etc.).

## Estado atual da escola (pós-expansão — ver docs/SPEC.md)

- **Escola em U** aberto para a quadra (leste): Bloco A (braço norte), Bloco B
  (braço sul) e Bloco C (conector novo, base do U a oeste), com portas de
  ligação C↔A e C↔B em todos os pavimentos.
- **4 pavimentos** nos 3 blocos (térreo + 3 superiores): pé-direito 3 m, lajes
  em y = 3, 6, 9, telhado em y = 12. Escadas A, B (meia-volta, pátio) e C
  (interna, Bloco C), 3 lances cada.
- **32 salas de aula** (`sala-1`…`sala-32`, 20 carteiras cada), mais refeitório,
  biblioteca, auditório, laboratório, artes, admin e **almoxarifado** no térreo
  do Bloco C (mesa + máquina Fill GLB + almoxarife no posto).
- **712 personagens** (índices estáveis do roster): 0 diretora · 1 secretário ·
  2–65: 64 professores (2 por sala, em rodízio) · 66–705: 640 alunos (20/sala,
  turma do turno atual) · 706–707: 2 cozinheiras · 708–709: 2 faxineiros ·
  710: porteiro · 711: almoxarife.
- **3 turnos, 7h–23h**: manhã (7h–11h30), tarde (13h–17h30) e noite
  (19h–22h50); wrap diário 23h → 7h. Ciclo de iluminação dia/noite em
  `src/world/Iluminacao.tsx` (sol/lua, céu/fog e holofotes da quadra à noite).
- **Painel de pincéis** (`src/ui/PinceisPanel.tsx`, canto inferior esquerdo)
  **substituiu o minimapa** (removido por completo): chave Sem/Com Allcanci,
  cargas por cor, estoque do almoxarifado, descartados e botão Repor estoque;
  dinâmica em `src/simulation/pinceis.ts`.
