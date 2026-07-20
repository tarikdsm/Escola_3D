# SPEC — Expansão: Escola em U, 4 andares, 3 turnos, pincéis Allcanci

Documento de coordenação da expansão. `src/contracts/` continua sendo a fonte única da
verdade; esta spec registra as decisões aprovadas pelo usuário e os contratos entre as
frentes de trabalho.

## Decisões aprovadas (entrevista)

1. Escola em **U aberto para a quadra** (leste): Bloco A = braço norte, Bloco B = braço
   sul, **Bloco C novo = base do U a oeste**, ligando A e B.
2. **4 pavimentos nos 3 blocos** (térreo + 3 superiores). Pé direito 3 m; lajes em
   y = 3, 6, 9; telhado em y = 12.
3. **32 salas de aula** no total. Professores = 32×2 = **64**. Alunos por turno =
   32×20 = **640** (total lógico 640×3 = 1.920, mas **só a turma do turno atual fica
   no campus** — buffers reutilizados).
4. **Almoxarifado no térreo do Bloco C**, com mesa e o modelo
   `public/models/maquina_fill_web.glb` em cima, e **1 funcionário exclusivo**
   (almoxarife) que fica no posto.
5. **3 turnos**: manhã 7h–12h, tarde 13h–18h, noite 19h–23h. Cada turno repete a
   rotina (chegada/aula 1/recreio/aula 2/saída). Na virada de turno a turma anterior
   sai e a nova entra. Wrap diário 23h → 7h.
6. **Ciclo de iluminação**: céu/sol mudam ao longo do dia; à noite escurece (lua,
   ambiente baixo, holofotes da quadra).
7. **Painel de pincéis substitui o Minimap** (canto inferior esquerdo). Conteúdo
   resumido: chave seletora **Sem Allcanci / Com Allcanci**, total de pincéis ativos
   (192), por cor (azul/verde/vermelho): total + carga média %, estoque do
   almoxarifado por cor, contador de descartados, botão **Repor estoque**.
8. **Dinâmica dos pincéis**: cada professor tem 3 pincéis (azul, verde, vermelho),
   carga 0–100 %. Durante AULA_1/AULA_2 o professor em aula consome o pincel ativo.
   Ao acabar, o professor **vai ao almoxarifado** (simulado visualmente):
   - **Sem Allcanci**: descarta os vazios e retira novos do estoque (se a cor estiver
     esgotada, fica com o pincel vazio).
   - **Com Allcanci**: recarrega na máquina Fill (fila na máquina, ~30 s de jogo por
     pincel); estoque não é consumido.
   - Estoque inicial: 3 por professor = **64 de cada cor** (192). Reposição manual
     via botão no painel (volta a 64/cor).
9. **Rodízio de professores**: 2 por sala; em AULA_1 um ensina e o outro fica na sala
   dos professores; em AULA_2 trocam.

## Geometria (contracts/layout.ts)

- Terreno, muro, guarita, portão e quadra **inalterados**.
- `CONST.ALTURA_TELHADO` passa a **12**; lajes intermediárias em y = 3, 6, 9.
  `CONST.TOTAL_PERSONAGENS` passa a **712**.
- **Bloco A** (norte): x −33…+33, z −32…−20 — 4 pavimentos, **16 salas de aula**
  (4 por andar, 11×9 m), ids `sala-1`…`sala-16`. Corredor/varanda como hoje,
  replicados por andar.
- **Bloco B** (sul): estendido para x −33…+29, z +10…+20 — 4 pavimentos.
  - Térreo: Refeitório, Banheiros M/F, Secretaria, Diretoria, Biblioteca (como hoje;
    a Sala dos Professores pequena pode virar outro uso administrativo a critério do
    agente de layout, documentado aqui depois).
  - 1º andar: Auditório, Laboratório, Sala de Artes (como hoje).
  - 2º e 3º andares: **8 salas de aula** (4 por andar), ids `sala-17`…`sala-24`.
- **Bloco C** (conector, novo): x −45…−33, z −32…+20 — 4 pavimentos.
  - Térreo: **Almoxarifado** (com mesa + máquina Fill + posto do almoxarife + fila),
    **Sala dos Professores grande** (capacidade ≥ 32 lugares) e escada.
  - 4 andares com **2 salas de aula por andar**, ids `sala-25`…`sala-32`.
- Portas de ligação entre C e os blocos A/B em todos os andares.
- **Escadas** (3 lances, térreo→3º andar): A (existente, estendida), B (existente,
  estendida), C (nova). `alturaNaRampa()` atualizada.
- **Carteiras: 20 por sala** (grade 5×4) — `CARTEIRAS` por sala.
- Novos anchors em layout: `ALMOXARIFADO` { mesa, posMaquina, postoAlmoxarife,
  fila[], porta }, sala dos professores grande { lugares[≥32] }.
- **Manter nomes/shapes dos exports existentes** (`SALAS`, `WALLS`, `SPANS`,
  `CARTEIRAS`, `QUADROS`, `MESAS_PROFESSOR`, `REFEITORIO`, `PATIO`, `PORTARIA`,
  `ADMIN`, `AUDITORIO`, `QUADRA`, `STAIRS`, `TERRENO`, `CONST`, `alturaNaRampa` etc.)
  — consumidores serão adaptados, mas os nomes não mudam.

## Roster (contracts/roster.ts) — 712 personagens

Índices estáveis: 0 diretora · 1 secretário · **2–65: 64 professores** (sala k tem os
profs 2+2(k−1) e 2+2(k−1)+1, com matéria) · **66–705: 640 alunos** (20 por sala,
`sala-${⌊(i−66)/20⌋+1}`) · 706–707: 2 cozinheiras · 708–709: 2 faxineiros ·
710: porteiro · **711: almoxarife** (papel novo `almoxarife`, paleta adulto).
Validação de runtime atualizada. `contracts/simBuffer.ts`: redimensionar para 712.

## Rotina (contracts/routine.ts)

- MANHÃ: CHEGADA 7:00 · AULA_1 7:30 · RECREIO 9:30 · AULA_2 10:00 · SAÍDA 11:30.
- TARDE: 13:00 · 13:30 · 15:30 · 16:00 · 17:30.
- NOITE: 19:00 · 19:20 · 21:00 · 21:20 · 22:50.
- `HORA_FECHAMENTO` = 23:00 (1380 min); wrap 23h → 7h.
- Entre SAÍDA de um turno e CHEGADA do seguinte, os alunos ficam fora do campus
  (pontos `spawnRua`); a turma "nova" é o mesmo conjunto de agentes, que re-entra na
  CHEGADA seguinte (KISS: mesma aparência).
- Adicionar noção de **turno** (`manha` | `tarde` | `noite`) além da fase
  (CHEGADA/AULA_1/…) — store expõe `turno` para o badge do HUD.

## Pincéis (simulation/pinceis.ts — módulo novo, fora do React)

- Estado: por professor (64): `{ azul, verde, vermelho }` cargas 0–100 (Float32Array
  64×3 ou array de objetos pré-alocado); `estoque { azul: 64, verde: 64, vermelho: 64 }`;
  `descartados` (contador); `pincelAtivo` por professor (rotaciona a cada ~2 min de
  jogo durante a aula).
- Consumo: só o professor **em aula** (não o do rodízio que descansa) drena o pincel
  ativo, ~1,5 %/min-jogo. Carga < 15 % em qualquer pincel → marca `precisaRepor`; ao
  fim do bloco de aula o professor vai ao almoxarifado (comportamento em
  simulation/behaviors.ts), resolve (troca ou recarga) e retoma a rotina.
- API pública (sem React, lida por polling pela UI a ~500 ms):
  - `obterResumoPinceis()` → `{ totalAtivos, porCor: { azul: { total, cargaMedia }, verde: {...}, vermelho: {...} }, estoque: { azul, verde, vermelho }, descartados }`
  - `reporEstoque()` → estoque volta a 64/cor.
  - `setComAllcanci(b: boolean)` / `getComAllcanci()` (espelhado na store Zustand).
  - `resetPinceis()` no wrap diário: cargas a 100 %, estoque **não** repõe
    automaticamente (só manual).
- A chave `comAllcanci` vive na store (`useSchoolStore`): campo `comAllcanci: boolean`
  (default `false` = "Sem Allcanci"), ação `toggleAllcanci()`; simulação lê do módulo.

## UI

- **`ui/PinceisPanel.tsx`** (novo) no lugar do Minimap (`.minimap` CSS removido;
  novo `.pinceis-panel` bottom-left). Polling de 500 ms em `obterResumoPinceis()`
  (nada de subscribe por frame). PT-BR. Chave seletora Sem/Com Allcanci +
  botão Repor estoque.
- **Minimap removido por completo**: `ui/Minimap.tsx`, CSS, campo `andarMinimap` da
  store e o mount no `App.tsx`.
- HUD (`ui/HUD.tsx`): badge passa a mostrar o **turno** (Manhã/Tarde/Noite) além/ou no
  lugar da fase atual — manter simples.

## Iluminação (world/Iluminacao.tsx — novo)

- Componente que lê `clockMin` (subscribe leve, ~1 Hz ou lerp por frame) e interpola:
  posição/intensidade/cor do sol, cor do céu/fog, luz ambiente/hemisférica.
  Noite: céu escuro, "lua" fraca, holofotes da quadra ligados (spotlights).
- Montado pela integração no `App.tsx` (substituindo o bloco fixo de luz atual).

## GLB — máquina Fill

- Mover `assets/maquina_fill_web.glb` → `public/models/maquina_fill_web.glb`.
- Carregar com `useGLTF` do drei: URL `` `${import.meta.env.BASE_URL}models/maquina_fill_web.glb` ``
  (base `/Escola_3D/` no GitHub Pages). `useGLTF.preload` no módulo.
- Renderizar em cima da mesa do almoxarifado (`ALMOXARIFADO.posMaquina`), escala
  ~0,4 m de altura, fallback procedural (caixa) se o load falhar (Suspense + ErrorBoundary simples).
- **Exceção à regra "100% procedural"**: este GLB é asset local mandatório do usuário;
  registrar a exceção no AGENTS.md na fase de integração.

## Personagens / simulação

- `characters/`: escalar para 712 instâncias (26 partes instanciadas); novo papel
  `almoxarife` (adulto, sem mochila; avental opcional). Vigiar FPS; zero alocação por
  frame continua obrigatório.
- `simulation/estado.ts`: chegada escalonada de 640 alunos (grupos maiores), assentos
  fixos 20/sala (índices 0–19 de `CARTEIRAS[salaId]`), spawns da turma nos pontos de
  rua nas trocas de turno.
- `simulation/behaviors.ts`: rodízio de professores (em AULA_1 ensina o prof de
  índice par da sala, em AULA_2 o ímpar — ou hash determinístico equivalente,
  documentar), professor `precisaRepor` → almoxarifado → retoma; almoxarife fica no
  posto (idle na mesa); demais papéis como hoje, adaptados aos 4 andares.
- Waypoints: regenerar o grafo (4 andares × 3 blocos + conector, 3 escadas de 3
  lances, pátio/quadra/rua). Manter `findPath`, `validateGraph`.

## Fases e donos de arquivo (não cruzar escopos)

- **Fase 1** (paralelo):
  - A1: `contracts/layout.ts`, `contracts/routine.ts`.
  - A2: `contracts/roster.ts`, `contracts/simBuffer.ts`.
- **Fase 1.5**: A3: `contracts/waypoints.ts` (depende do layout final).
- **Fase 2** (paralelo):
  - W1: `src/world/groundFloor/**` (térreo: salas 1–4?, admin B, refeitório, etc. —
    conforme layout final; NÃO criar Almoxarifado.tsx).
  - W2: `src/world/upperFloor/**` (3 andares superiores, escadas, telhado y=12).
  - W3: `src/world/exterior/**` (fachadas do U, Bloco C, quadra/pátio/muro).
  - W4: `src/world/Almoxarifado.tsx` (novo) + `public/models/maquina_fill_web.glb`.
  - W5: `src/characters/**`.
  - W6: `src/simulation/**` (+ `simulation/pinceis.ts` novo; pode tocar
    `contracts/events.ts` se inevitável — documentar).
  - W7: `src/state/**` + `src/ui/**` (PinceisPanel, remoção do Minimap, HUD, CSS).
  - W8: `src/world/Iluminacao.tsx` (novo).
- **Fase 3** (integração, 1 agente): `src/App.tsx`/`main.tsx` (montar Almoxarifado,
  Iluminacao, PinceisPanel; remover Minimap), `npm run build` verde, ajustes de
  câmera se preciso, atualizar `AGENTS.md` (712 personagens, U/4 andares, exceção
  GLB, fim do minimap) e `README.md` se aplicável.
- Depois: commit + push e verificação do deploy (autorizado por AGENTS.md).

## Invariantes de qualidade

- `npm run build` (typecheck + vite build) verde ao final de cada fase de integração.
- Strings visíveis e comentários em PT-BR.
- Nada de setState por frame; posições/animações em buffers; instancing para
  geometria repetida (carteiras 32×20 = 640 lugares, paredes, janelas etc.).
- Aparência determinística (RNG semeado) preservada.

## Estado final (pós-integração, fase 3)

Integração concluída e `npm run build` verde (typecheck + vite build). Montagem
final em `src/App.tsx`: `<Iluminacao />` substituiu o bloco de luz fixo dentro
do `<Canvas>`, `<Almoxarifado />` montado junto aos pisos e `<PinceisPanel />`
montado no DOM no lugar do `<Minimap />` (removido por completo: componente,
CSS, campo da store e referências em comentários).

Desvios e decisões relevantes em relação a esta spec:

- **Hall de convivência no Bloco A**: o trecho leste (x +11…+33) de cada
  pavimento do Bloco A virou hall aberto ao corredor, em vez de salas —
  as 16 salas do Bloco A ocupam x −33…+11.
- **Sala dos professores pequena → Coordenação Pedagógica**: a antiga sala dos
  professores do térreo do Bloco B virou Coordenação (x +13…+21); a sala dos
  professores grande ficou no térreo do Bloco C, como previsto.
- **Guarda-corpo da escada-b**: o span norte do patamar (z=+3, y=6) foi
  corrigido pelo W2 para cobrir só x −22…−18 (o trecho x −26…−22 fecha o fluxo
  da meia-volta e ficou aberto). Na integração avaliou-se fechar também o vão
  da borda SUL do patamar (x −26…−22, z=+6): **decidiu-se NÃO fechar** — a
  escada-a, padrão existente, deixa o trecho equivalente sobre os lances
  aberto; personagens nunca trafegam ali (arestas do grafo seguem a meia-volta).
  Registrado aqui para referência futura.
- **Canteiro sudoeste do pátio movido**: o canteiro/árvore em (−28, 6) invadia
  ~1 m a projeção do lance 1 da escada B; movidos para (−29,5; 7,5) (~0,5 m de
  folga da escada e da fachada do Bloco C). O nó de grade `patio-(-30,9)` caiu
  dentro do canteiro e deixou de existir; grafo revalidado: **499 nós, todos
  alcançáveis** (`validateGraph()`).
- **Quadros brancos nas 32 salas**: o mapa sala→matéria de `quadroBranco.ts`
  era fixo nas 12 salas antigas e lançaria erro nas demais; passou a ser gerado
  de `IDS_SALAS_AULA` em rotação das 12 matérias (sala-1…12 mantêm o conteúdo
  original; sala-13…32 repetem o ciclo). Térreo (6 salas) e andares superiores
  (26 salas) montam `<QuadrosBrancos>` com seus ids.
- **27 partes instanciadas de personagem** (a spec estimava 26).
- **Câmera aérea mantida**: `maxDistance` 170 + fov 55° cobrem o U de
  140×92 m com folga; nenhum ajuste de limites foi necessário.
- **GLB da máquina Fill**: exceção à regra "100% procedural" registrada no
  AGENTS.md; carregado de `public/models/maquina_fill_web.glb` via `useGLTF`
  com fallback procedural.

## Pós-expansão: slider de tempo + acabamento das escadas

- **Slider de viagem no tempo** (`src/ui/TimeSlider.tsx`, rodapé centro):
  slider absoluto 7h–23h (direita = futuro, esquerda = passado), botões ±30 min,
  ticks nos sinos e faixas por turno (tudo derivado de `ROTINA`/`CONST`).
  Futuro: perseguição em passos grossos (1–5 s de jogo, adaptativo) em fatias
  por frame (orçamento 12 ms/96 passos; pior caso ~5,4 s). Passado: `resetDia()`
  + perseguição (replay consistente — pincéis/posições re-simulados). Módulo
  `src/simulation/viagemTempo.ts` (sem importar a store — sem ciclo); hook em
  `step.ts`; store ganha `viajando`/`minutoAlvoViagem`/`viajarPara`/
  `cancelarViagem`; sino mudo durante a viagem (`ui/audio.ts`); separação de
  agentes desligada na perseguição (88–100% do custo era `separacao`→
  `cruzaParede` — otimização futura: índice espacial de paredes).
- **Escadas — acabamento** (geometria do contrato preservada, decisão do
  usuário): lances elevados com fundo liso (viga-caixão inclinada 0,25 m +
  degraus-caixote finos); patamares/passarelas y=6 com vigas de borda 0,25×0,5
  e escoras inclinadas ancoradas nos lances (sem pilares no chão do pátio);
  bocel escuro no nariz de cada degrau (`PALETTE.degrauBocel`); corrimãos em
  dois níveis (0,92/0,50 m), balaústres a cada ~0,4 m. Geometria pura em
  `src/world/upperFloor/props/staircaseGeometry.ts`.
- **Correção de grafo**: nó `patio--25-9` ficava dentro do corpo maciço do
  lance 1 da escada B (rampa a 2,6 m, sem vão) — o filtro da grade do pátio
  agora pula qualquer ponto na projeção de lances com base no solo
  (`dentroDeLanceMacico`). Grafo revalidado: **498 nós, 100% alcançável**.
