# Explorador de Escola Virtual Brasileira 3D

Simulador 3D, 100% no navegador, de uma escola pública brasileira em estilo
low-poly: dois blocos de dois andares, pátio, quadra poliesportiva e 79
personagens animados vivendo um dia letivo completo — chegada, aulas, recreio
com bola rolando, almoço e saída — com sino, relógio acelerado e câmera que
alterna entre caminhar pelos corredores e sobrevoar a escola inteira.

Nenhum asset externo é usado: toda a geometria é procedural (caixas, cilindros
e planos do three.js), as texturas são geradas em `CanvasTexture` e os sons são
sintetizados em tempo real via WebAudio.

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

| Entrada | Ação |
| --- | --- |
| `Tab` | Alterna caminhar (1ª pessoa) ↔ vista aérea |
| `W` `A` `S` `D` ou setas | Mover (modo caminhando) |
| Mouse | Olhar — clique na tela para travar o cursor |
| `Shift` | Correr |
| Botão esquerdo + arrastar / roda | Orbitar / zoom (modo aéreo) |
| Clique num personagem | Abre o cartão com nome, função e o que está fazendo |
| `M` | Liga/desliga os sons |
| `H` ou `?` | Abre/fecha a ajuda |
| `Esc` | Libera o mouse / fecha a ajuda |
| Botões `1×` `2×` `4×` (HUD) | Velocidade da simulação |
| Botões `Térreo` / `1º Andar` (minimapa) | Andar exibido no mapa |

## Como funciona a simulação

O dia letivo vai das **7h às 12h**, com o relógio rodando 10 s de jogo por
segundo real (multiplicável por 2 ou 4 na HUD). Ao meio-dia o dia recomeça
automaticamente às 7h. Os períodos mudam nos marcos da rotina, sempre anunciados
pelo sino:

| Horário | Período | O que acontece |
| --- | --- | --- |
| 7h00 | Chegada | Portão abre; alunos entram em grupos e conversam no pátio |
| 7h30 🔔 | 1ª aula | Alunos sentam nas suas carteiras; professores escrevem no quadro |
| 9h30 🔔 | Recreio | Bola rolando na quadra, fila da cantina, lanche e conversa |
| 10h00 🔔 | 2ª aula | Todo mundo de volta às salas |
| 11h30 🔔 | Almoço e saída | Refeitório e saída pelo portão até o dia recomeçar |

Os **79 personagens** têm funções próprias: 60 alunos (5 por sala, 12 salas),
12 professores (um por sala, com matéria), a diretora (que ronda a escola), o
secretário, 2 cozinheiras (atrás do balcão nos horários de refeição),
2 faxineiros (varrendo pátio e corredores) e o porteiro (sempre perto do
portão, que abre e fecha conforme o período). O minimapa mostra todos em tempo
real, por andar.

## Técnicas usadas

- **React 18 + @react-three/fiber + drei** sobre three.js, com TypeScript
  estrito e Vite.
- **Instancing** (`InstancedMesh`) para tudo que se repete: cada parte do corpo
  dos 79 personagens é um único draw call (~10 no total), assim como carteiras,
  cadeiras, paredes, bancos, árvores e o alambrado.
- **Buffers fora do React**: posições, orientações e animações dos personagens
  trafegam em `Float32Array`/`Uint8Array` (`src/contracts/simBuffer.ts`),
  escritos pela simulação e lidos pelo render a cada frame — nada de
  `setState` por frame (a store Zustand só carrega estado de baixa frequência:
  relógio, período, atividades a 1 Hz).
- **Navegação por waypoints com A\***: grafo de 261 nós cobrindo salas,
  corredores, escadas e pátio (`src/contracts/waypoints.ts`), com separação
  anti-sobreposição por hash espacial e verificação de cruzamento de paredes.
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
│   ├── groundFloor/  # térreo: salas 1–6, diretoria, secretaria, refeitório,
│   │                 # biblioteca, banheiros
│   ├── upperFloor/   # 1º andar: salas 7–12, auditório, laboratório, artes,
│   │                 # escadarias e telhado
│   └── exterior/     # terreno, pátio, quadra, muros, portão, fachada, vegetação
├── characters/   # render instanciado + animações + picking dos 79 personagens
├── simulation/   # relógio, máquina de períodos, navegação e comportamentos
├── player/       # câmera/controles (caminhar com colisão / vista aérea)
└── ui/           # HUD, minimapa, cartão de personagem, ajuda e áudio (DOM)
```
