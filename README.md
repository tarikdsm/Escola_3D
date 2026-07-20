# Explorador de Escola Virtual Brasileira 3D

Simulador 3D, 100% no navegador, de uma escola pública brasileira em estilo
low-poly: escola em U de 4 pavimentos (3 blocos ligados por um conector),
pátio, quadra poliesportiva e 712 personagens animados vivendo 3 turnos de
aula — manhã, tarde e noite, das 7h às 23h, com ciclo de iluminação
dia/noite — chegadas, aulas, recreios com bola rolando e saídas — com sino,
relógio acelerado e câmera que alterna entre caminhar pelos corredores,
sobrevoar a escola inteira e voar livremente (atravessando paredes e telhado).

Nenhum asset externo é usado: toda a geometria é procedural (caixas, cilindros
e planos do three.js), as texturas são geradas em `CanvasTexture` e os sons são
sintetizados em tempo real via WebAudio. Única exceção: o modelo GLB local da
máquina Fill (`public/models/maquina_fill_web.glb`), no almoxarifado.

## Requisitos

- Node.js 18 ou superior

## Como rodar

```bash
npm install     # instala as dependências (uma vez)
npm run dev     # servidor de desenvolvimento (http://localhost:5173)
npm run build   # gera a versão de produção em dist/
npm run preview # serve o build de produção (http://localhost:4173)
```

## Controles

**Geral**

| Entrada | Ação |
| --- | --- |
| `Tab` | Alterna caminhar (1ª pessoa) ↔ vista aérea (sai do voo, se estiver voando) |
| `F` | Modo voar — liga/desliga (voo livre, atravessa paredes e telhado) |
| `M` | Liga/desliga os sons |
| `H` ou `?` | Abre/fecha a ajuda |
| `Esc` | Libera o mouse / fecha a ajuda |
| Clique num personagem | Abre o cartão com nome, função e o que está fazendo |

**Caminhando e voando**

| Entrada | Ação |
| --- | --- |
| Mouse | Olhar — clique na tela para travar o cursor |
| Segurar botão esquerdo | Ir para frente (no voo, na direção do olhar) |
| Segurar botão direito | Ir para trás |
| `W` `A` `S` `D` ou setas | Mover |
| `Shift` | Correr / voar rápido |
| `Espaço` / `Ctrl` | Subir / descer (só no voo) |

**Vista aérea**

| Entrada | Ação |
| --- | --- |
| Segurar botão esquerdo / direito | Avançar / recuar a câmera |
| Rodinha do mouse | Zoom |
| Arrastar com o botão do meio | Girar em volta da escola |

**HUD e painel de pincéis**

| Entrada | Ação |
| --- | --- |
| Botões `1×` `2×` `4×` (HUD) | Velocidade da simulação |
| Chave `Sem/Com Allcanci` (painel) | Modo de reposição dos pincéis (troca por novos × recarga na máquina Fill) |
| Botão `Repor estoque` (painel) | Estoque do almoxarifado volta a 64 pincéis por cor |

## Como funciona a simulação

A escola funciona das **7h às 23h em 3 turnos**, com o relógio rodando 10 s de
jogo por segundo real (multiplicável por 2 ou 4 na HUD). Cada turno repete a
rotina chegada → 1ª aula → recreio → 2ª aula → saída; na virada de turno a
turma anterior sai pelo portão e a nova entra, e às 23h o dia recomeça às 7h
do dia seguinte. Os períodos mudam nos marcos da rotina, sempre anunciados
pelo sino:

| Turno | Chegada | 1ª aula 🔔 | Recreio 🔔 | 2ª aula 🔔 | Saída 🔔 |
| --- | --- | --- | --- | --- | --- |
| Manhã | 7h00 | 7h30 | 9h30 | 10h00 | 11h30 |
| Tarde | 13h00 | 13h30 | 15h30 | 16h00 | 17h30 |
| Noite | 19h00 | 19h20 | 21h00 | 21h20 | 22h50 |

Os **712 personagens** têm funções próprias: 640 alunos (20 por sala, 32 salas
— só a turma do turno atual está no campus), 64 professores (2 por sala, em
rodízio, com matéria), a diretora (que ronda a escola), o secretário,
2 cozinheiras (atrás do balcão nos horários de refeição), 2 faxineiros
(varrendo pátio e corredores), o porteiro (sempre perto do portão, que abre e
fecha conforme o período) e o almoxarife (no posto do almoxarifado).

Cada professor carrega 3 pincéis de quadro branco (azul, verde e vermelho) que
se desgastam durante as aulas. Quando acabam, ele vai ao almoxarifado: no modo
**Sem Allcanci** troca por pincéis novos do estoque; no modo **Com Allcanci**
recarrega na máquina Fill. O painel de pincéis (canto inferior esquerdo) mostra
as cargas por cor, o estoque e os descartados.

## Técnicas usadas

- **React 18 + @react-three/fiber + drei** sobre three.js, com TypeScript
  estrito e Vite.
- **Instancing** (`InstancedMesh`) para tudo que se repete: cada uma das 27
  partes do corpo dos 712 personagens é um único draw call, assim como as 640
  carteiras, cadeiras, paredes, bancos, árvores e o alambrado.
- **Buffers fora do React**: posições, orientações e animações dos personagens
  trafegam em `Float32Array`/`Uint8Array` (`src/contracts/simBuffer.ts`),
  escritos pela simulação e lidos pelo render a cada frame — nada de
  `setState` por frame (a store Zustand só carrega estado de baixa frequência:
  relógio, período, atividades a 1 Hz).
- **Navegação por waypoints com A\***: grafo de 499 nós cobrindo salas,
  corredores, escadas dos 4 pavimentos e pátio (`src/contracts/waypoints.ts`),
  com separação anti-sobreposição por hash espacial e verificação de
  cruzamento de paredes.
- **Ciclo de iluminação dia/noite** (`src/world/Iluminacao.tsx`): sol, céu, fog
  e luz ambiente interpolados ao longo do dia; à noite, "lua" azulada,
  ambiente baixo e holofotes da quadra acesos.
- **Áudio 100% procedural** (WebAudio, sem arquivos): sino de campainha,
  murmúrio ambiente por período, bola quicando no recreio e pássaros.
- **Colisão e altura de piso** próprias para o jogador (push-out eixo a eixo,
  rampas das escadarias contínuas).

## Estrutura de pastas

```
src/
├── contracts/    # fonte única da verdade: layout (paredes/âncoras), waypoints,
│                 # rotina, roster, buffers da simulação, store e eventos
├── state/        # implementação Zustand da store
├── world/
│   ├── groundFloor/  # térreo: salas 1–4 e 25–26, admin (diretoria, secretaria,
│   │                 # coordenação), refeitório, biblioteca, banheiros,
│   │                 # sala dos professores
│   ├── upperFloor/   # 1º–3º andares: salas 5–24 e 27–32, auditório,
│   │                 # laboratório, artes, escadarias e telhado (y=12)
│   ├── exterior/     # terreno, pátio, quadra, muros, portão, fachadas do U,
│   │                 # vegetação
│   ├── Almoxarifado.tsx  # almoxarifado do Bloco C (mesa + máquina Fill GLB)
│   └── Iluminacao.tsx    # ciclo de iluminação dia/noite
├── characters/   # render instanciado (27 partes) + animações + picking dos 712
├── simulation/   # relógio, máquina de períodos/turnos, navegação, pincéis e
│                 # comportamentos
├── player/       # câmera/controles (caminhar com colisão / vista aérea / voo livre)
└── ui/           # HUD, painel de pincéis, cartão de personagem, ajuda e áudio (DOM)
```
