/**
 * layout.ts — GEOGRAFIA FÍSICA COMPLETA da escola (fonte única da verdade).
 *
 * Unidade = metros, Y-up, origem (0,0,0) no centro do pátio.
 * Piso térreo y=0 · lajes intermediárias y=3, 6, 9 · telhado sobre y=12.
 *
 * EXPANSÃO (ver docs/SPEC.md): escola em U aberto para a quadra (leste),
 * 4 pavimentos nos 3 blocos, 32 salas de aula, almoxarifado no Bloco C.
 *
 * MAPA GERAL (visto de cima; norte = Z negativo, sul = Z positivo):
 *
 *        x:  -62 ............................................... +78
 *   z=-47,5 ── MURO NORTE ─────────────────────────────────────────────
 *   ┌─ BLOCO C (x −45…−33, z −32…+20) — conector oeste do U, 4 pavimentos ─┐
 *   │ térreo: sala-25 (z −32…−24), sala-26 (z −24…−16),
 *   │   ALMOXARIFADO (z −16…−6: mesa + máquina Fill + almoxarife + fila),
 *   │   hall + escada C (z −6…+2), SALA DOS PROFESSORES grande (z +2…+20, 40 lug.)
 *   │ andares 1–3: 2 salas/pavimento (sala-27…sala-32) + áreas de convivência
 *   │ corredor/varanda leste (x −36…−33); portas de ligação p/ A (z=−21,5)
 *   │   e p/ B (z=+11,5) em TODOS os pavimentos; fachada p/ o pátio z −20…+10
 *   └──────────────────────────────────────────────────────────────────────┘
 *   ┌─ BLOCO A (x −33…+33, z −32…−20) — braço norte, 4 pavimentos ─┐
 *   │ 4 salas/pavimento de 11×9 (sala-1…sala-16) em x −33…+11;
 *   │ hall de convivência a leste (x +11…+33), aberto ao corredor;
 *   │ corredor térreo / varandas z −23…−20 (guarda-corpo em z=−20)
 *   └──────────────────────────────────────────────────────────────┘
 *      PÁTIO CENTRAL (z −20…+10): bancos, árvores, canteiros, mastro (0,0,−5)
 *      escada A (meia-volta, 3 lances): x 22…30, z −20…−3 (+ passarela y=6)
 *      escada B (meia-volta, 3 lances): x −26…−18, z +2…+10 (+ passarela y=6)
 *   ┌─ BLOCO B (x −33…+29, z +10…+20) — braço sul, 4 pavimentos ─┐
 *   │ térreo (z +13…+20): Refeitório x −33…−11 · Banheiros M x −11…−7,
 *   │   F x −7…−3 · Secretaria x −3…+5 · Diretoria x +5…+13 ·
 *   │   Coordenação Pedagógica x +13…+21 (antiga sala dos professores) ·
 *   │   Biblioteca x +21…+29
 *   │ 1º andar: Auditório x −33…−5 · Laboratório x −5…+11 · Artes x +11…+29
 *   │ 2º/3º andares: 4 salas/pavimento de 15,5×7 (sala-17…sala-24)
 *   │ passeio coberto térreo / varandas z +10…+13 (guarda-corpo em z=+10)
 *   └────────────────────────────────────────────────────────────┘
 *   QUADRA (x +40…+70, z −15…+10) a leste, com alambrado — INALTERADA
 *   z=+45 ── MURO SUL: portão x −22…−18, guarita x −16…−13 — INALTERADOS ──
 *   RUA/calçada: z > +45 (spawn dos alunos em spawnRua)
 *
 * CONVENÇÃO DOS WALLS (paredes): lista final de AABBs SÓLIDOS já com os
 * vãos de porta/janela recortados (cada vão vira segmentos laterais + peitoril
 * e/ou verga). Serve tanto para RENDERIZAÇÃO (1 Box por AABB) quanto para
 * COLISÃO. Espessuras: paredes 0,2 m · muros 0,3 m · alambrado 0,1 m.
 * Alturas dos vãos: portas 0→2,1 (duplas 0→2,3) · janelas 1,0→2,2
 * (banheiros 1,6→2,2) · portão da rua: vão total · saídas do corredor A: 0→2,4.
 *
 * NOTA DE ESCOPO (expansão): o tipo `Andar` em types.ts ainda é `0 | 1`;
 * os pavimentos 2 e 3 usam coerção local (`ANDAR()`) até a integração
 * ampliar o tipo para `0 | 1 | 2 | 3`.
 */

import type { AABB, Andar, RectXZ, SalaDef, VaoPorta, Vec3 } from './types';

// ---------------------------------------------------------------------------
// Constantes globais
// ---------------------------------------------------------------------------

export const CONST = {
  /** Altura de um pavimento (pé-direito) — lajes em y=3, 6, 9. */
  ALTURA_PISO: 3,
  PE_DIREITO: 3,
  /** Base do telhado (topo do 4º pavimento). */
  ALTURA_TELHADO: 12,
  /** Escala de tempo do jogo: 10 s de jogo por 1 s real. */
  ESCALA_TEMPO: 10,
  /** Minutos desde 00:00 da abertura do portão (7h00). */
  HORA_ABERTURA: 7 * 60,
  /** Minutos desde 00:00 do fechamento (23h00) — wrap diário 23h → 7h. */
  HORA_FECHAMENTO: 23 * 60,
  /** Velocidades em m/s (jogo). */
  VEL_PASSEIO: 1.2,
  VEL_ANDAR: 1.7,
  VEL_CORRER: 3.4,
  VEL_JOGADOR: 4.5,
  /** Total de personagens (== ROSTER.length; duplicado aqui p/ buffers). */
  TOTAL_PERSONAGENS: 712,
} as const;

/** Limites do terreno murado (planta). */
export const TERRENO = {
  minX: -62,
  maxX: 78,
  minZ: -47.5,
  maxZ: 45,
} as const;

// ---------------------------------------------------------------------------
// Salas (SALAS)
// ---------------------------------------------------------------------------

const AULAS_CORES = [
  '#f4a261',
  '#e9c46a',
  '#2a9d8f',
  '#e76f51',
  '#8ecae6',
  '#ffb4a2',
  '#b5e48c',
  '#ffc6ff',
  '#90e0a3',
  '#ffd166',
  '#a0c4ff',
  '#ffadad',
];

/** Pavimentos da expansão. `Andar` (types.ts) ainda é `0 | 1` — ver nota de escopo. */
const ANDAR = (n: number) => n as Andar;

/** Bases y dos 4 pavimentos (térreo, 1º, 2º, 3º). */
const YS_ANDARES = [0, 3, 6, 9];

/**
 * Sala de aula do Bloco A: 4 por pavimento (11×9 m) em x −33…+11, z −32…−23.
 * `n` = número global (1–16), `j` = posição no pavimento (0–3, oeste→leste).
 * Porta para o corredor/varanda na parede sul (z=−23); 2 janelas na norte (z=−32).
 */
function salaDeAulaA(n: number, j: number, andar: Andar): SalaDef {
  const x0 = -33 + 11 * j;
  const cx = x0 + 5.5;
  return {
    id: `sala-${n}`,
    nome: `Sala ${n}`,
    tipo: 'aula',
    andar,
    rect: { x: x0, z: -32, w: 11, d: 9 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: cx, z: -23, largura: 1.0, eixo: 'x' }],
    janelas: [
      { x: cx - 2.5, z: -32, largura: 1.6, eixo: 'x' },
      { x: cx + 2.5, z: -32, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: AULAS_CORES[(n - 1) % AULAS_CORES.length],
  };
}

/**
 * Sala de aula do Bloco B (2º/3º pavimentos): 4 por pavimento (15,5×7 m),
 * z +13…+20. Porta para a varanda na parede norte (z=+13); quadro na parede
 * sul (z=+20, lado da rua); janelas nas duas fachadas.
 */
function salaDeAulaB(n: number, j: number, andar: Andar): SalaDef {
  const x0 = -33 + 15.5 * j;
  const cx = x0 + 7.75;
  return {
    id: `sala-${n}`,
    nome: `Sala ${n}`,
    tipo: 'aula',
    andar,
    rect: { x: x0, z: 13, w: 15.5, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: cx + 5, z: 13, largura: 1.0, eixo: 'x' }],
    janelas: [
      { x: cx - 4.5, z: 13, largura: 1.6, eixo: 'x' },
      { x: cx - 4, z: 20, largura: 1.6, eixo: 'x' },
      { x: cx + 3, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: AULAS_CORES[(n - 1) % AULAS_CORES.length],
  };
}

/**
 * Sala de aula do Bloco C: 2 por pavimento (9×8 m) — norte em z −32…−24,
 * sul em z −24…−16. Porta para o corredor na parede leste (x=−36);
 * quadro na parede oeste (x=−45); janelas na oeste (+ janela no fechamento
 * norte do bloco para a sala do extremo norte).
 */
function salaDeAulaC(n: number, norte: boolean, andar: Andar): SalaDef {
  const z0 = norte ? -32 : -24;
  const cz = z0 + 4;
  const janelas: VaoPorta[] = [
    { x: -45, z: cz - 2, largura: 1.6, eixo: 'z' },
    { x: -45, z: cz + 2, largura: 1.6, eixo: 'z' },
  ];
  if (norte) janelas.push({ x: -41, z: -32, largura: 1.6, eixo: 'x' });
  return {
    id: `sala-${n}`,
    nome: `Sala ${n}`,
    tipo: 'aula',
    andar,
    rect: { x: -45, z: z0, w: 9, d: 8 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -36, z: cz, largura: 1.0, eixo: 'z' }],
    janelas,
    corDestaque: AULAS_CORES[(n - 1) % AULAS_CORES.length],
  };
}

export const SALAS: SalaDef[] = [
  // --- Bloco A: 16 salas de aula (4 por pavimento × 4 pavimentos) ---
  ...[0, 1, 2, 3].flatMap((a) => [0, 1, 2, 3].map((j) => salaDeAulaA(a * 4 + j + 1, j, ANDAR(a)))),

  // --- Bloco B, térreo (z +13…+20; portas voltadas ao pátio, parede z=+13) ---
  {
    id: 'refeitorio',
    nome: 'Refeitório / Cantina',
    tipo: 'refeitorio',
    andar: ANDAR(0),
    rect: { x: -33, z: 13, w: 22, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -20, z: 13, largura: 2.0, eixo: 'x' }],
    janelas: [
      { x: -30.5, z: 13, largura: 1.6, eixo: 'x' },
      { x: -14.5, z: 13, largura: 1.6, eixo: 'x' },
      { x: -30.5, z: 20, largura: 1.6, eixo: 'x' },
      { x: -22, z: 20, largura: 1.6, eixo: 'x' },
      { x: -14.5, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#f4a261',
  },
  {
    id: 'banheiro-m',
    nome: 'Banheiro Masculino',
    tipo: 'banheiro',
    andar: ANDAR(0),
    rect: { x: -11, z: 13, w: 4, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -9, z: 13, largura: 0.9, eixo: 'x' }],
    janelas: [{ x: -9, z: 20, largura: 1.2, eixo: 'x' }],
    corDestaque: '#8ecae6',
  },
  {
    id: 'banheiro-f',
    nome: 'Banheiro Feminino',
    tipo: 'banheiro',
    andar: ANDAR(0),
    rect: { x: -7, z: 13, w: 4, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -5, z: 13, largura: 0.9, eixo: 'x' }],
    janelas: [{ x: -5, z: 20, largura: 1.2, eixo: 'x' }],
    corDestaque: '#ffc6ff',
  },
  {
    id: 'secretaria',
    nome: 'Secretaria',
    tipo: 'secretaria',
    andar: ANDAR(0),
    rect: { x: -3, z: 13, w: 8, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: 1, z: 13, largura: 0.9, eixo: 'x' }],
    janelas: [
      { x: 3.4, z: 13, largura: 1.6, eixo: 'x' }, // guichê de atendimento
      { x: 1, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#ffd166',
  },
  {
    id: 'diretoria',
    nome: 'Diretoria',
    tipo: 'diretoria',
    andar: ANDAR(0),
    rect: { x: 5, z: 13, w: 8, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: 9, z: 13, largura: 0.9, eixo: 'x' }],
    janelas: [
      { x: 6.5, z: 13, largura: 1.6, eixo: 'x' },
      { x: 11.5, z: 13, largura: 1.6, eixo: 'x' },
      { x: 9, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#e76f51',
  },
  {
    // Antiga sala dos professores do Bloco B, rededicada (decisão A1, permitida
    // pela SPEC): a sala dos professores oficial agora é a grande, no Bloco C.
    id: 'coordenacao',
    nome: 'Coordenação Pedagógica',
    tipo: 'admin',
    andar: ANDAR(0),
    rect: { x: 13, z: 13, w: 8, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: 17, z: 13, largura: 0.9, eixo: 'x' }],
    janelas: [
      { x: 19.4, z: 13, largura: 1.6, eixo: 'x' },
      { x: 17, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#b5e48c',
  },
  {
    id: 'biblioteca',
    nome: 'Biblioteca',
    tipo: 'biblioteca',
    andar: ANDAR(0),
    rect: { x: 21, z: 13, w: 8, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: 25, z: 13, largura: 0.9, eixo: 'x' }],
    janelas: [
      { x: 22.7, z: 13, largura: 1.6, eixo: 'x' },
      { x: 27.4, z: 13, largura: 1.6, eixo: 'x' },
      { x: 25, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#a0c4ff',
  },

  // --- Bloco B, 1º andar ---
  {
    id: 'auditorio',
    nome: 'Auditório',
    tipo: 'auditorio',
    andar: ANDAR(1),
    rect: { x: -33, z: 13, w: 28, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -17, z: 13, largura: 1.8, eixo: 'x' }],
    janelas: [
      { x: -26.2, z: 13, largura: 1.6, eixo: 'x' },
      { x: -7.2, z: 13, largura: 1.6, eixo: 'x' },
      { x: -22, z: 20, largura: 1.6, eixo: 'x' },
      { x: -12, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#b03a2e',
  },
  {
    id: 'laboratorio',
    nome: 'Laboratório de Ciências/Informática',
    tipo: 'lab',
    andar: ANDAR(1),
    rect: { x: -5, z: 13, w: 16, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: 3, z: 13, largura: 1.0, eixo: 'x' }],
    janelas: [
      { x: -2.2, z: 13, largura: 1.6, eixo: 'x' },
      { x: 5.8, z: 13, largura: 1.6, eixo: 'x' },
      { x: 3, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#2a9d8f',
  },
  {
    id: 'sala-artes',
    nome: 'Sala de Artes',
    tipo: 'artes',
    andar: ANDAR(1),
    rect: { x: 11, z: 13, w: 18, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: 20, z: 13, largura: 1.0, eixo: 'x' }],
    janelas: [
      { x: 13.8, z: 13, largura: 1.6, eixo: 'x' },
      { x: 25, z: 13, largura: 1.6, eixo: 'x' },
      { x: 20, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#9b5de5',
  },

  // --- Bloco B, 2º e 3º andares: 8 salas de aula (sala-17…sala-24) ---
  ...[2, 3].flatMap((a) => [0, 1, 2, 3].map((j) => salaDeAulaB(17 + (a - 2) * 4 + j, j, ANDAR(a)))),

  // --- Bloco C, térreo ---
  salaDeAulaC(25, true, ANDAR(0)),
  salaDeAulaC(26, false, ANDAR(0)),
  {
    id: 'almoxarifado',
    nome: 'Almoxarifado',
    // TipoSala (types.ts) ainda não tem 'almoxarifado' — usa 'admin' até a
    // integração ampliar o tipo (ver SPEC).
    tipo: 'admin',
    andar: ANDAR(0),
    rect: { x: -45, z: -16, w: 9, d: 10 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -36, z: -11, largura: 1.2, eixo: 'z' }],
    janelas: [
      { x: -45, z: -13, largura: 1.2, eixo: 'z' },
      { x: -45, z: -9, largura: 1.2, eixo: 'z' },
    ],
    corDestaque: '#c9ada7',
  },
  {
    // Sala dos Professores GRANDE (capacidade 40 lugares ≥ 32 — ver SPEC).
    // Mantém o id estável 'sala-professores' (a antiga sala pequena do
    // Bloco B virou 'coordenacao').
    id: 'sala-professores',
    nome: 'Sala dos Professores',
    tipo: 'salaProfessores',
    andar: ANDAR(0),
    rect: { x: -45, z: 2, w: 9, d: 18 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -36, z: 8, largura: 1.4, eixo: 'z' }],
    janelas: [
      { x: -45, z: 6, largura: 1.6, eixo: 'z' },
      { x: -45, z: 11, largura: 1.6, eixo: 'z' },
      { x: -45, z: 16, largura: 1.6, eixo: 'z' },
      { x: -42, z: 20, largura: 1.6, eixo: 'x' },
      { x: -38, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#b5e48c',
  },

  // --- Bloco C, andares 1–3: 2 salas de aula por pavimento (sala-27…sala-32) ---
  ...[1, 2, 3].flatMap((a) => [
    salaDeAulaC(25 + 2 * a, true, ANDAR(a)),
    salaDeAulaC(26 + 2 * a, false, ANDAR(a)),
  ]),
];

const SALAS_POR_ID = new Map(SALAS.map((s) => [s.id, s]));

/** Busca uma sala pelo id. Lança erro se o id não existir. */
export function getSala(id: string): SalaDef {
  const s = SALAS_POR_ID.get(id);
  if (!s) throw new Error(`Sala desconhecida: ${id}`);
  return s;
}

// ---------------------------------------------------------------------------
// Paredes (WALLS) — geradas a partir de "spans" + vãos (portas/janelas)
// ---------------------------------------------------------------------------

/** Vão numa parede, medido AO LONGO do eixo da parede; yDe/yAte relativos a yBase. */
interface VaoMuro {
  de: number;
  ate: number;
  yDe: number;
  yAte: number;
}

/** Trecho de parede reta sobre um eixo, na cota fixa perpendicular. */
interface SpanMuro {
  eixo: 'x' | 'z';
  /** Cota fixa da parede (z, se eixo='x'; x, se eixo='z'). */
  fixo: number;
  /** Início e fim ao longo do eixo da parede. */
  de: number;
  ate: number;
  /** Cota y da base da parede. */
  yBase: number;
  /** Altura total da parede. */
  altura: number;
  /** Espessura (default 0,2). */
  esp?: number;
  vaos: VaoMuro[];
}

/** Corta um span pelos vãos e devolve os AABBs sólidos resultantes. */
function spanParaAABBs(s: SpanMuro): AABB[] {
  const esp = s.esp ?? 0.2;
  const out: AABB[] = [];
  const push = (de: number, ate: number, y0: number, y1: number) => {
    if (ate - de <= 0.001 || y1 - y0 <= 0.001) return;
    const min: Vec3 =
      s.eixo === 'x' ? [de, y0, s.fixo - esp / 2] : [s.fixo - esp / 2, y0, de];
    const max: Vec3 =
      s.eixo === 'x' ? [ate, y1, s.fixo + esp / 2] : [s.fixo + esp / 2, y1, ate];
    out.push({ min, max });
  };
  const vaos = [...s.vaos].sort((a, b) => a.de - b.de);
  let cursor = s.de;
  for (const v of vaos) {
    push(cursor, v.de, s.yBase, s.yBase + s.altura); // trecho cheio antes do vão
    push(v.de, v.ate, s.yBase, s.yBase + v.yDe); // peitoril sob o vão
    push(v.de, v.ate, s.yBase + v.yAte, s.yBase + s.altura); // verga sobre o vão
    cursor = v.ate;
  }
  push(cursor, s.ate, s.yBase, s.yBase + s.altura); // trecho final
  return out;
}

/**
 * Spans manuais (estrutura dos blocos, muros, guarita, alambrado, guarda-corpos).
 * Os vãos das portas/janelas declarados em SALAS são acrescentados
 * automaticamente ao span correspondente (mesma cota/andar/posição).
 */
const SPANS: SpanMuro[] = [
  // ===== BLOCO A (x −33…+33, z −32…−20) — 4 pavimentos =====
  ...YS_ANDARES.flatMap((y): SpanMuro[] => [
    // Parede norte (z=−32) — janelas das salas (auto) + 3 janelas do hall leste.
    {
      eixo: 'x',
      fixo: -32,
      de: -33,
      ate: 33,
      yBase: y,
      altura: 3,
      vaos: [
        { de: 15.2, ate: 16.8, yDe: 1.0, yAte: 2.2 },
        { de: 21.2, ate: 22.8, yDe: 1.0, yAte: 2.2 },
        { de: 27.2, ate: 28.8, yDe: 1.0, yAte: 2.2 },
      ],
    },
    // Parede salas↔corredor/varanda (z=−23), trecho das salas x −33…+11 —
    // recebe as portas das salas (auto). O hall (x +11…+33) é aberto ao corredor.
    { eixo: 'x', fixo: -23, de: -33, ate: 11, yBase: y, altura: 3, vaos: [] },
    // Divisórias entre as 4 salas + fechamento oeste do hall (x=+11).
    ...[-22, -11, 0, 11].map(
      (x): SpanMuro => ({ eixo: 'z', fixo: x, de: -32, ate: -23, yBase: y, altura: 3, vaos: [] }),
    ),
    // Lateral leste (x=+33), trecho das salas/hall, com 1 janela.
    {
      eixo: 'z',
      fixo: 33,
      de: -32,
      ate: -23,
      yBase: y,
      altura: 3,
      vaos: [{ de: -28, ate: -26.4, yDe: 1.0, yAte: 2.2 }],
    },
    // Lateral oeste (x=−33) — parede compartilhada com o Bloco C.
    // Vão da PORTA DE LIGAÇÃO C↔A (corredores), presente em todos os pavimentos.
    {
      eixo: 'z',
      fixo: -33,
      de: -32,
      ate: -20,
      yBase: y,
      altura: 3,
      vaos: [{ de: -22.1, ate: -20.9, yDe: 0, yAte: 2.1 }],
    },
  ]),
  // Fechamento leste do corredor/varanda do Bloco A (x=+33, z −23…−20):
  // parede cheia no térreo; guarda-corpo nos pavimentos superiores.
  { eixo: 'z', fixo: 33, de: -23, ate: -20, yBase: 0, altura: 3, vaos: [] },
  ...[3, 6, 9].map(
    (y): SpanMuro => ({ eixo: 'z', fixo: 33, de: -23, ate: -20, yBase: y, altura: 1.1, vaos: [] }),
  ),
  // Parede sul do corredor térreo (z=−20) com 3 saídas de 2,4 m p/ o pátio.
  {
    eixo: 'x',
    fixo: -20,
    de: -33,
    ate: 33,
    yBase: 0,
    altura: 3,
    vaos: [
      { de: -17.7, ate: -15.3, yDe: 0, yAte: 2.4 },
      { de: -1.2, ate: 1.2, yDe: 0, yAte: 2.4 },
      { de: 15.3, ate: 17.7, yDe: 0, yAte: 2.4 },
    ],
  },
  // Guarda-corpos das varandas do Bloco A (z=−20), com os vãos da escada A:
  // 1º andar: chegada do lance 1 + partida do lance 2 (x 26…30);
  // 2º andar: passarela (x 22…24); 3º andar: chegada do lance 3 (x 26…28).
  {
    eixo: 'x',
    fixo: -20,
    de: -33,
    ate: 33,
    yBase: 3,
    altura: 1.1,
    vaos: [{ de: 26, ate: 30, yDe: 0, yAte: 1.1 }],
  },
  {
    eixo: 'x',
    fixo: -20,
    de: -33,
    ate: 33,
    yBase: 6,
    altura: 1.1,
    vaos: [{ de: 22, ate: 24, yDe: 0, yAte: 1.1 }],
  },
  {
    eixo: 'x',
    fixo: -20,
    de: -33,
    ate: 33,
    yBase: 9,
    altura: 1.1,
    vaos: [{ de: 26, ate: 28, yDe: 0, yAte: 1.1 }],
  },

  // ===== BLOCO B (x −33…+29, z +10…+20; cômodos z +13…+20) — 4 pavimentos =====
  ...YS_ANDARES.flatMap((y): SpanMuro[] => [
    // Parede norte dos cômodos (z=+13) — recebe portas e janelas (auto).
    { eixo: 'x', fixo: 13, de: -33, ate: 29, yBase: y, altura: 3, vaos: [] },
    // Parede sul (z=+20, fachada da rua, onde fica o letreiro) — janelas (auto).
    { eixo: 'x', fixo: 20, de: -33, ate: 29, yBase: y, altura: 3, vaos: [] },
    // Lateral oeste (x=−33) — parede compartilhada com o Bloco C.
    // Vão da PORTA DE LIGAÇÃO C↔B (corredores), presente em todos os pavimentos.
    {
      eixo: 'z',
      fixo: -33,
      de: 10,
      ate: 20,
      yBase: y,
      altura: 3,
      vaos: [{ de: 10.9, ate: 12.1, yDe: 0, yAte: 2.1 }],
    },
  ]),
  // Divisórias do térreo (refeitório|banh.M|banh.F|secretaria|diretoria|coordenação|biblioteca).
  ...[-11, -7, -3, 5, 13, 21].map(
    (x): SpanMuro => ({ eixo: 'z', fixo: x, de: 13, ate: 20, yBase: 0, altura: 3, vaos: [] }),
  ),
  // Divisórias do 1º andar (auditório|laboratório|artes).
  ...[-5, 11].map(
    (x): SpanMuro => ({ eixo: 'z', fixo: x, de: 13, ate: 20, yBase: 3, altura: 3, vaos: [] }),
  ),
  // Divisórias dos 2º/3º andares (4 salas de aula por pavimento).
  ...[6, 9].flatMap((y): SpanMuro[] =>
    [-17.5, -2, 13.5].map(
      (x): SpanMuro => ({ eixo: 'z', fixo: x, de: 13, ate: 20, yBase: y, altura: 3, vaos: [] }),
    ),
  ),
  // Lateral leste do Bloco B (x=+29): térreo com janela; superiores com janela
  // + guarda-corpo da varanda (z +10…+13).
  {
    eixo: 'z',
    fixo: 29,
    de: 10,
    ate: 20,
    yBase: 0,
    altura: 3,
    vaos: [{ de: 15.7, ate: 17.3, yDe: 1.0, yAte: 2.2 }],
  },
  ...[3, 6, 9].flatMap((y): SpanMuro[] => [
    {
      eixo: 'z',
      fixo: 29,
      de: 13,
      ate: 20,
      yBase: y,
      altura: 3,
      vaos: [{ de: 15.7, ate: 17.3, yDe: 1.0, yAte: 2.2 }],
    },
    { eixo: 'z', fixo: 29, de: 10, ate: 13, yBase: y, altura: 1.1, vaos: [] },
  ]),
  // Guarda-corpos das varandas do Bloco B (z=+10), com os vãos da escada B:
  // 1º andar: chegada do lance 1 + partida do lance 2 (x −26…−22);
  // 2º andar: passarela (x −20…−18); 3º andar: chegada do lance 3 (x −26…−24).
  {
    eixo: 'x',
    fixo: 10,
    de: -33,
    ate: 29,
    yBase: 3,
    altura: 1.1,
    vaos: [{ de: -26, ate: -22, yDe: 0, yAte: 1.1 }],
  },
  {
    eixo: 'x',
    fixo: 10,
    de: -33,
    ate: 29,
    yBase: 6,
    altura: 1.1,
    vaos: [{ de: -20, ate: -18, yDe: 0, yAte: 1.1 }],
  },
  {
    eixo: 'x',
    fixo: 10,
    de: -33,
    ate: 29,
    yBase: 9,
    altura: 1.1,
    vaos: [{ de: -26, ate: -24, yDe: 0, yAte: 1.1 }],
  },

  // ===== BLOCO C (x −45…−33, z −32…+20) — 4 pavimentos =====
  ...YS_ANDARES.flatMap((y): SpanMuro[] => {
    // Janelas manuais das áreas livres (halls) dos pavimentos superiores —
    // no térreo essas áreas são cômodos declarados em SALAS (vãos automáticos).
    const janelasHallOeste: VaoMuro[] =
      y === 0
        ? []
        : [
            { de: -12.8, ate: -11.2, yDe: 1.0, yAte: 2.2 },
            { de: -2.8, ate: -1.2, yDe: 1.0, yAte: 2.2 },
            { de: 7.2, ate: 8.8, yDe: 1.0, yAte: 2.2 },
            { de: 13.2, ate: 14.8, yDe: 1.0, yAte: 2.2 },
          ];
    const janelasHallSul: VaoMuro[] =
      y === 0
        ? []
        : [
            { de: -42.8, ate: -41.2, yDe: 1.0, yAte: 2.2 },
            { de: -38.8, ate: -37.2, yDe: 1.0, yAte: 2.2 },
          ];
    return [
      // Parede oeste (x=−45) — janelas dos cômodos (auto) + janelas dos halls.
      { eixo: 'z', fixo: -45, de: -32, ate: 20, yBase: y, altura: 3, vaos: janelasHallOeste },
      // Fechamento norte (z=−32) — recebe a janela da sala do extremo norte (auto).
      { eixo: 'x', fixo: -32, de: -45, ate: -33, yBase: y, altura: 3, vaos: [] },
      // Fechamento sul (z=+20) — térreo: janelas da sala dos professores (auto);
      // superiores: janelas manuais do hall.
      { eixo: 'x', fixo: 20, de: -45, ate: -33, yBase: y, altura: 3, vaos: janelasHallSul },
      // Divisória entre as 2 salas de aula do pavimento (z=−24).
      { eixo: 'x', fixo: -24, de: -45, ate: -36, yBase: y, altura: 3, vaos: [] },
    ];
  }),
  // Parede interna salas↔corredor (x=−36), térreo: trechos dos cômodos
  // (recebem as portas automáticas); o hall da escada (z −6…+2) fica aberto.
  { eixo: 'z', fixo: -36, de: -32, ate: -16, yBase: 0, altura: 3, vaos: [] },
  { eixo: 'z', fixo: -36, de: -16, ate: -6, yBase: 0, altura: 3, vaos: [] },
  { eixo: 'z', fixo: -36, de: 2, ate: 20, yBase: 0, altura: 3, vaos: [] },
  // Parede interna x=−36 nos pavimentos superiores: só o trecho das salas;
  // as áreas de convivência (z −16…+20) são abertas ao corredor.
  ...[3, 6, 9].map(
    (y): SpanMuro => ({ eixo: 'z', fixo: -36, de: -32, ate: -16, yBase: y, altura: 3, vaos: [] }),
  ),
  // Divisórias do almoxarifado no térreo (z=−16 e z=−6, x −45…−36).
  { eixo: 'x', fixo: -16, de: -45, ate: -36, yBase: 0, altura: 3, vaos: [] },
  { eixo: 'x', fixo: -6, de: -45, ate: -36, yBase: 0, altura: 3, vaos: [] },
  // Fachada leste do Bloco C para o pátio (x=−33, z −20…+10), térreo:
  // 2 portas (alinhadas ao almoxarifado e à sala dos professores) + janelas.
  {
    eixo: 'z',
    fixo: -33,
    de: -20,
    ate: 10,
    yBase: 0,
    altura: 3,
    vaos: [
      { de: -11.7, ate: -10.3, yDe: 0, yAte: 2.1 }, // porta (em frente ao almoxarifado)
      { de: 7.3, ate: 8.7, yDe: 0, yAte: 2.1 }, // porta (em frente à sala dos professores)
      { de: -18.8, ate: -17.2, yDe: 1.0, yAte: 2.2 }, // janela
      { de: -2.8, ate: -1.2, yDe: 1.0, yAte: 2.2 }, // janela (hall da escada)
    ],
  },
  // Varandas do corredor do Bloco C: guarda-corpo (x=−33, z −20…+10) nos andares.
  ...[3, 6, 9].map(
    (y): SpanMuro => ({ eixo: 'z', fixo: -33, de: -20, ate: 10, yBase: y, altura: 1.1, vaos: [] }),
  ),
  // Guarda-corpos das aberturas da escada C nas lajes (ver STAIRS/'escada-c'):
  // laje y=3: vão sobre o lance 1 (x −45…−43); laje y=6: vão sobre o lance 2
  // (x −43…−41); laje y=9: vão sobre o lance 3 (x −45…−43).
  { eixo: 'z', fixo: -43, de: -6, ate: 2, yBase: 3, altura: 1.1, vaos: [] },
  { eixo: 'x', fixo: 2, de: -45, ate: -43, yBase: 3, altura: 1.1, vaos: [] },
  { eixo: 'z', fixo: -41, de: -6, ate: 2, yBase: 6, altura: 1.1, vaos: [] },
  { eixo: 'x', fixo: -6, de: -43, ate: -41, yBase: 6, altura: 1.1, vaos: [] },
  { eixo: 'z', fixo: -43, de: -6, ate: 2, yBase: 9, altura: 1.1, vaos: [] },
  { eixo: 'x', fixo: 2, de: -45, ate: -43, yBase: 9, altura: 1.1, vaos: [] },

  // ===== ESCADA A — patamar + passarela flutuantes em y=6 (x 22…30, z −20…−3) =====
  { eixo: 'x', fixo: -3, de: 22, ate: 30, yBase: 6, altura: 1.1, vaos: [] }, // patamar, sul
  { eixo: 'z', fixo: 30, de: -6, ate: -3, yBase: 6, altura: 1.1, vaos: [] }, // patamar, leste
  { eixo: 'z', fixo: 22, de: -6, ate: -3, yBase: 6, altura: 1.1, vaos: [] }, // patamar, oeste
  { eixo: 'x', fixo: -6, de: 24, ate: 26, yBase: 6, altura: 1.1, vaos: [] }, // brecha entre passarela e lance 3
  { eixo: 'z', fixo: 22, de: -20, ate: -6, yBase: 6, altura: 1.1, vaos: [] }, // passarela, oeste
  { eixo: 'z', fixo: 24, de: -20, ate: -6, yBase: 6, altura: 1.1, vaos: [] }, // passarela, leste

  // ===== ESCADA B — patamar + passarela flutuantes em y=6 (x −26…−18, z +2…+10) =====
  // Patamar, norte (z=+3): CORREÇÃO AUTORIZADA (W2) — o span cobria x −26…−18
  // inteiros e FECHAVA o fluxo da meia-volta (topos dos lances 2/3 em z≈+2,
  // x −26…−22 → patamar z +3…+6). Espelhando a escada-a (que na cota dos
  // lances guarda só a "brecha" sem circulação), o guarda-corpo passa a
  // cobrir apenas o trecho leste x −22…−18, onde há queda livre; o trecho
  // x −26…−22 fica aberto.
  { eixo: 'x', fixo: 3, de: -22, ate: -18, yBase: 6, altura: 1.1, vaos: [] }, // patamar, norte
  { eixo: 'z', fixo: -26, de: 3, ate: 6, yBase: 6, altura: 1.1, vaos: [] }, // patamar, oeste
  { eixo: 'z', fixo: -18, de: 3, ate: 6, yBase: 6, altura: 1.1, vaos: [] }, // patamar, leste
  { eixo: 'x', fixo: 6, de: -22, ate: -20, yBase: 6, altura: 1.1, vaos: [] }, // brecha entre lance 3 e passarela
  { eixo: 'z', fixo: -20, de: 6, ate: 10, yBase: 6, altura: 1.1, vaos: [] }, // passarela, oeste
  { eixo: 'z', fixo: -18, de: 6, ate: 10, yBase: 6, altura: 1.1, vaos: [] }, // passarela, leste

  // ===== MUROS DO TERRENO (esp 0,3; altura 2,2) — INALTERADOS =====
  { eixo: 'x', fixo: -47.5, de: -62, ate: 78, yBase: 0, altura: 2.2, esp: 0.3, vaos: [] },
  {
    eixo: 'x',
    fixo: 45,
    de: -62,
    ate: 78,
    yBase: 0,
    altura: 2.2,
    esp: 0.3,
    // PORTÃO: vão total de 4 m em x −22…−18.
    vaos: [{ de: -22, ate: -18, yDe: 0, yAte: 2.2 }],
  },
  { eixo: 'z', fixo: -62, de: -47.5, ate: 45, yBase: 0, altura: 2.2, esp: 0.3, vaos: [] },
  { eixo: 'z', fixo: 78, de: -47.5, ate: 45, yBase: 0, altura: 2.2, esp: 0.3, vaos: [] },

  // ===== GUARITA DO PORTEIRO (x −16…−13, z +42…+45, altura 2,6) — INALTERADA =====
  {
    eixo: 'x',
    fixo: 42,
    de: -16,
    ate: -13,
    yBase: 0,
    altura: 2.6,
    vaos: [{ de: -14.95, ate: -14.05, yDe: 0, yAte: 2.1 }],
  },
  {
    eixo: 'z',
    fixo: -16,
    de: 42,
    ate: 45,
    yBase: 0,
    altura: 2.6,
    vaos: [{ de: 43.2, ate: 44.2, yDe: 1.0, yAte: 2.1 }],
  },
  { eixo: 'z', fixo: -13, de: 42, ate: 45, yBase: 0, altura: 2.6, vaos: [] },

  // ===== ALAMBRADO DA QUADRA (x +40…+70, z −15…+10) — INALTERADO =====
  {
    eixo: 'z',
    fixo: 40,
    de: -15,
    ate: 10,
    yBase: 0,
    altura: 3,
    esp: 0.1,
    vaos: [
      { de: -6, ate: -2, yDe: 0, yAte: 3 },
      { de: 4, ate: 7, yDe: 0, yAte: 3 },
    ],
  },
  { eixo: 'z', fixo: 70, de: -15, ate: 10, yBase: 0, altura: 3, esp: 0.1, vaos: [] },
  { eixo: 'x', fixo: -15, de: 40, ate: 70, yBase: 0, altura: 3, esp: 0.1, vaos: [] },
  { eixo: 'x', fixo: 10, de: 40, ate: 70, yBase: 0, altura: 3, esp: 0.1, vaos: [] },
];

// Acrescenta os vãos declarados nas SALAS aos spans correspondentes.
for (const sala of SALAS) {
  const yBase = sala.andar * CONST.ALTURA_PISO;
  const candidatos = [...sala.portas.map((p) => ({ vao: p, porta: true })), ...sala.janelas.map((j) => ({ vao: j, porta: false }))];
  for (const { vao, porta } of candidatos) {
    const fixo = vao.eixo === 'x' ? vao.z : vao.x;
    const pos = vao.eixo === 'x' ? vao.x : vao.z;
    const span = SPANS.find(
      (s) => s.eixo === vao.eixo && s.fixo === fixo && s.yBase === yBase && pos >= s.de && pos <= s.ate,
    );
    if (!span) {
      throw new Error(
        `Sem span de parede para ${porta ? 'porta' : 'janela'} da sala '${sala.id}' em (${vao.x}, ${vao.z}), andar ${sala.andar}.`,
      );
    }
    span.vaos.push({
      de: pos - vao.largura / 2,
      ate: pos + vao.largura / 2,
      yDe: porta ? 0 : sala.tipo === 'banheiro' ? 1.6 : 1.0,
      yAte: porta ? (vao.largura >= 1.8 ? 2.3 : 2.1) : 2.2,
    });
  }
}

/**
 * Lista final de paredes/muros/guarda-corpos/balcões como AABBs sólidos
 * (vãos já recortados). Últimas entradas: balcão da cantina (x −27…−14, z ~17,
 * altura 1,1; a passagem para a cozinha é o vão x −14…−12 junto à divisória)
 * e mesa do almoxarifado (x −42…−38, z ~−10, altura 0,9).
 */
export const WALLS: AABB[] = [
  ...SPANS.flatMap(spanParaAABBs),
  { min: [-27, 0, 16.9], max: [-14, 1.1, 17.1] }, // balcão da cantina
  { min: [-42, 0, -10.15], max: [-38, 0.9, -9.85] }, // mesa do almoxarifado
];

// ---------------------------------------------------------------------------
// Escadarias (STAIRS) — 3 escadas de 3 lances (térreo → 3º andar)
// ---------------------------------------------------------------------------

/**
 * Um lance reto de escada: sobe 3 m (um pavimento) de `base` a `topo`.
 * `dir` é a direção horizontal de subida (normalizada, y=0).
 */
export interface LanceDef {
  /** Ponto central da base do lance (y = nível de partida). */
  base: Vec3;
  /** Ponto central do topo do lance (y = nível de chegada). */
  topo: Vec3;
  /** Direção horizontal de subida (normalizada, y=0). */
  dir: Vec3;
}

/**
 * Escada em meia-volta de 3 lances. Os lances 1 e 3 ocupam a MESMA projeção
 * em planta (um sobre o outro, 6 m acima) — por isso `alturaNaRampa` aceita
 * um `yRef` para desambiguar. `patamares` são lajes/plataformas de
 * escoamento (inclui as passarelas flutuantes em y=6 das escadas A e B,
 * que ligam o patamar à varanda do 2º andar).
 */
export interface StairDef {
  id: string;
  /** Lances em ordem de subida (térreo → 3º andar); cada um sobe 3 m. */
  lances: LanceDef[];
  /** Largura útil de cada lance (ao longo do eixo perpendicular a `dir`). */
  largura: number;
  /** Patamares/plataformas de escoamento (rect em planta + cota y). */
  patamares: { rect: RectXZ; y: number }[];
  /** Centro da base do 1º lance (atalho p/ lances[0].base — compat). */
  base: Vec3;
  /** Centro do topo do último lance (atalho p/ lances[2].topo — compat). */
  topo: Vec3;
  /** Ponto central do patamar principal (compat com o contrato antigo). */
  patamar: Vec3;
  /** Direção do 1º lance (compat com o contrato antigo). */
  dir: Vec3;
}

export const STAIRS: StairDef[] = [
  {
    // Escadaria PRINCIPAL (Bloco A), estendida p/ 3 lances em meia-volta.
    // Projeção no chão: lances x 22…30, z −20…−3; passarela y=6 x 22…24.
    // Lance 1 (oeste, x 26…28): pátio → varanda do 1º andar.
    // Lance 2 (leste, x 28…30): varanda do 1º → patamar flutuante y=6.
    // Lance 3 (oeste, x 26…28): patamar y=6 → varanda do 3º andar.
    // O 2º andar é alcançado pela passarela y=6 (x 22…24) patamar→varanda.
    id: 'escada-a',
    lances: [
      { base: [27, 0, -6], topo: [27, 3, -20], dir: [0, 0, -1] },
      { base: [29, 3, -20], topo: [29, 6, -6], dir: [0, 0, 1] },
      { base: [27, 6, -6], topo: [27, 9, -20], dir: [0, 0, -1] },
    ],
    largura: 2,
    patamares: [
      { rect: { x: 22, z: -6, w: 8, d: 3 }, y: 6 }, // patamar x 22…30, z −6…−3
      { rect: { x: 22, z: -20, w: 2, d: 14 }, y: 6 }, // passarela x 22…24, z −20…−6
    ],
    base: [27, 0, -6],
    topo: [27, 9, -20],
    patamar: [26, 6, -4.5],
    dir: [0, 0, -1],
  },
  {
    // Escadaria SECUNDÁRIA (Bloco B), estendida p/ 3 lances em meia-volta.
    // Projeção no chão: lances x −26…−22, z +2…+10; patamar y=6 x −26…−18,
    // z +3…+6; passarela y=6 x −20…−18, z +6…+10 (liga à varanda do 2º andar).
    id: 'escada-b',
    lances: [
      { base: [-25, 0, 2], topo: [-25, 3, 10], dir: [0, 0, 1] },
      { base: [-23, 3, 10], topo: [-23, 6, 2], dir: [0, 0, -1] },
      { base: [-25, 6, 2], topo: [-25, 9, 10], dir: [0, 0, 1] },
    ],
    largura: 2,
    patamares: [
      { rect: { x: -26, z: 3, w: 8, d: 3 }, y: 6 }, // patamar x −26…−18, z +3…+6
      { rect: { x: -20, z: 6, w: 2, d: 4 }, y: 6 }, // passarela x −20…−18, z +6…+10
    ],
    base: [-25, 0, 2],
    topo: [-25, 9, 10],
    patamar: [-22, 6, 4.5],
    dir: [0, 0, 1],
  },
  {
    // Escadaria do BLOCO C (nova, interna, junto à parede oeste do hall
    // z −6…+2). Cada lance desemboca na laje do pavimento seguinte através
    // de aberturas protegidas por guarda-corpos (ver SPANS do Bloco C) —
    // os "patamares" são as próprias lajes (por isso `patamares` é vazio).
    id: 'escada-c',
    lances: [
      { base: [-44, 0, 2], topo: [-44, 3, -6], dir: [0, 0, -1] },
      { base: [-42, 3, -6], topo: [-42, 6, 2], dir: [0, 0, 1] },
      { base: [-44, 6, 2], topo: [-44, 9, -6], dir: [0, 0, -1] },
    ],
    largura: 2,
    patamares: [],
    base: [-44, 0, 2],
    topo: [-44, 9, -6],
    patamar: [-43, 3, -6],
    dir: [0, 0, -1],
  },
];

/**
 * Altura y do piso da escada no ponto (x, z), considerando TODOS os lances
 * e patamares da escada (interpolação linear por lance).
 * Retorna `null` quando (x, z) está fora da projeção da escada
 * (com margem de 0,3 m) — use isso para colisão/subida de jogador e NPCs.
 *
 * Como os lances 1 e 3 se sobrepõem em planta (meia-volta), o parâmetro
 * opcional `yRef` desambigua: devolve o candidato mais próximo de `yRef`,
 * desde que a diferença seja ≤ 1,5 m (senão, `null` — ex.: alguém andando
 * no pátio SOB um lance elevado não é capturado por ele). Sem `yRef`,
 * devolve o MENOR candidato (compatível com o contrato antigo).
 */
export function alturaNaRampa(stair: StairDef, x: number, z: number, yRef?: number): number | null {
  const candidatos: number[] = [];
  for (const lance of stair.lances) {
    const dx = lance.dir[0];
    const dz = lance.dir[2];
    const total =
      (lance.topo[0] - lance.base[0]) * dx + (lance.topo[2] - lance.base[2]) * dz;
    const along = (x - lance.base[0]) * dx + (z - lance.base[2]) * dz;
    const lat = Math.abs((x - lance.base[0]) * -dz + (z - lance.base[2]) * dx);
    if (lat > stair.largura / 2 + 0.3 || along < -0.3 || along > total + 0.3) continue;
    const t = Math.min(Math.max(along, 0), total);
    const k = total === 0 ? 0 : t / total;
    candidatos.push(lance.base[1] + (lance.topo[1] - lance.base[1]) * k);
  }
  for (const p of stair.patamares) {
    if (
      x >= p.rect.x - 0.3 &&
      x <= p.rect.x + p.rect.w + 0.3 &&
      z >= p.rect.z - 0.3 &&
      z <= p.rect.z + p.rect.d + 0.3
    ) {
      candidatos.push(p.y);
    }
  }
  if (candidatos.length === 0) return null;
  if (yRef === undefined) return Math.min(...candidatos);
  let melhor: number | null = null;
  let melhorDist = Infinity;
  for (const y of candidatos) {
    const d = Math.abs(y - yRef);
    if (d < melhorDist) {
      melhorDist = d;
      melhor = y;
    }
  }
  return melhorDist <= 1.5 ? melhor : null;
}

// ---------------------------------------------------------------------------
// Espinhos de corredor (usados pelo grafo de waypoints e pela renderização)
// ---------------------------------------------------------------------------

export interface CorredorSpine {
  id: string;
  andar: Andar;
  de: Vec3;
  ate: Vec3;
}

/**
 * Linhas centrais dos corredores/passagens, percorridas por waypoints a cada ~4 m:
 * - corredor-a-0 / varanda-a-1…3: corredor/varandas do Bloco A (z=−21,5);
 * - passeio-b-0 / varanda-b-1…3: passeio/varandas do Bloco B (z=+11,5);
 * - corredor-c-0…3: corredor/varanda leste do Bloco C (x=−34,5).
 */
export const CORREDOR_SPINES: CorredorSpine[] = [
  { id: 'corredor-a-0', andar: ANDAR(0), de: [-31, 0, -21.5], ate: [31, 0, -21.5] },
  { id: 'varanda-a-1', andar: ANDAR(1), de: [-31, 3, -21.5], ate: [31, 3, -21.5] },
  { id: 'varanda-a-2', andar: ANDAR(2), de: [-31, 6, -21.5], ate: [31, 6, -21.5] },
  { id: 'varanda-a-3', andar: ANDAR(3), de: [-31, 9, -21.5], ate: [31, 9, -21.5] },
  { id: 'passeio-b-0', andar: ANDAR(0), de: [-31, 0, 11.5], ate: [27, 0, 11.5] },
  { id: 'varanda-b-1', andar: ANDAR(1), de: [-31, 3, 11.5], ate: [27, 3, 11.5] },
  { id: 'varanda-b-2', andar: ANDAR(2), de: [-31, 6, 11.5], ate: [27, 6, 11.5] },
  { id: 'varanda-b-3', andar: ANDAR(3), de: [-31, 9, 11.5], ate: [27, 9, 11.5] },
  { id: 'corredor-c-0', andar: ANDAR(0), de: [-34.5, 0, -31], ate: [-34.5, 0, 19] },
  { id: 'corredor-c-1', andar: ANDAR(1), de: [-34.5, 3, -31], ate: [-34.5, 3, 19] },
  { id: 'corredor-c-2', andar: ANDAR(2), de: [-34.5, 6, -31], ate: [-34.5, 6, 19] },
  { id: 'corredor-c-3', andar: ANDAR(3), de: [-34.5, 9, -31], ate: [-34.5, 9, 19] },
];

// ---------------------------------------------------------------------------
// Âncoras de mobiliário (posições exatas usadas por arquitetura E pela IA)
// ---------------------------------------------------------------------------

/** Ids das 32 salas de aula, em ordem ('sala-1'…'sala-32'). */
export const IDS_SALAS_AULA = SALAS.filter((s) => s.tipo === 'aula').map((s) => s.id);

/**
 * Parede do quadro de cada sala de aula, deduzida do número da sala:
 * 1–16 (Bloco A): quadro na parede NORTE (z mínimo do rect);
 * 17–24 (Bloco B): quadro na parede SUL (z máximo do rect, lado da rua);
 * 25–32 (Bloco C): quadro na parede OESTE (x mínimo do rect).
 */
type LadoQuadro = 'N' | 'S' | 'O';

function ladoQuadro(id: string): LadoQuadro {
  const n = Number(id.slice(5));
  return n <= 16 ? 'N' : n <= 24 ? 'S' : 'O';
}

/** 5 colunas de carteiras (offsets ao longo da largura da sala). */
const COLUNAS_CARTEIRAS = [-3.2, -1.6, 0, 1.6, 3.2];
/** 4 fileiras (distâncias da parede do quadro) — salas profundas (A: 9 m; C: 9 m). */
const FILEIRAS_CARTEIRAS = [2.2, 3.5, 4.8, 6.1];
/** 4 fileiras das salas do Bloco B (7 m de profundidade). */
const FILEIRAS_CARTEIRAS_B = [2.0, 3.2, 4.4, 5.6];

/**
 * Carteiras dos alunos por sala de aula: grade 5 colunas × 4 fileiras = 20
 * lugares, voltadas ao quadro. Posições = centro do ASSENTO (y = piso do
 * pavimento). Ordem: fileiras da frente (perto do quadro) para o fundo,
 * colunas da esquerda para a direita — os índices 0–19 são os assentos
 * fixos dos 20 alunos da turma (ver SPEC/simulation).
 */
export const CARTEIRAS: Record<string, Vec3[]> = Object.fromEntries(
  IDS_SALAS_AULA.map((id) => {
    const sala = getSala(id);
    const { x, z, w, d } = sala.rect;
    const y = sala.andar * CONST.ALTURA_PISO;
    const lado = ladoQuadro(id);
    const fileiras = lado === 'S' ? FILEIRAS_CARTEIRAS_B : FILEIRAS_CARTEIRAS;
    const lugares: Vec3[] = [];
    for (const f of fileiras) {
      for (const c of COLUNAS_CARTEIRAS) {
        if (lado === 'N') lugares.push([x + w / 2 + c, y, z + f]);
        else if (lado === 'S') lugares.push([x + w / 2 + c, y, z + d - f]);
        else lugares.push([x + f, y, z + d / 2 + c]);
      }
    }
    return [id, lugares];
  }),
);

/**
 * Quadro de cada sala de aula: centro na parede do quadro (0,15 m para
 * dentro da sala), `normal` apontando para dentro da sala. `pos` já tem a
 * altura do centro do quadro (1,6 m acima do piso do pavimento).
 */
export const QUADROS: Record<string, { pos: Vec3; normal: Vec3 }> = Object.fromEntries(
  IDS_SALAS_AULA.map((id) => {
    const sala = getSala(id);
    const { x, z, w, d } = sala.rect;
    const y = sala.andar * CONST.ALTURA_PISO;
    const lado = ladoQuadro(id);
    if (lado === 'N') {
      return [id, { pos: [x + w / 2, y + 1.6, z + 0.15] as Vec3, normal: [0, 0, 1] as Vec3 }];
    }
    if (lado === 'S') {
      return [id, { pos: [x + w / 2, y + 1.6, z + d - 0.15] as Vec3, normal: [0, 0, -1] as Vec3 }];
    }
    return [id, { pos: [x + 0.15, y + 1.6, z + d / 2] as Vec3, normal: [1, 0, 0] as Vec3 }];
  }),
);

/** Mesa do professor em cada sala de aula (centro do tampo, y = piso). */
export const MESAS_PROFESSOR: Record<string, Vec3> = Object.fromEntries(
  IDS_SALAS_AULA.map((id) => {
    const sala = getSala(id);
    const { x, z, w, d } = sala.rect;
    const y = sala.andar * CONST.ALTURA_PISO;
    const lado = ladoQuadro(id);
    if (lado === 'N') return [id, [x + w / 2, y, z + 1.4] as Vec3];
    if (lado === 'S') return [id, [x + w / 2, y, z + d - 1.4] as Vec3];
    return [id, [x + 1.4, y, z + d / 2] as Vec3];
  }),
);

/**
 * Âncoras do refeitório/cantina:
 * - balcao: 6 pontos de serviço ATRÁS do balcão (lado da cozinha, z=17,6),
 *   onde as cozinheiras ficam;
 * - filaSlots: 8 posições em fila única à FRENTE do balcão (a 1ª é a ponta,
 *   a última é quem está sendo servido);
 * - mesas: 4 mesas comunitárias, cada uma com 6 lugares (3 por lado).
 */
export const REFEITORIO = {
  balcao: ([-26, -24, -22, -20, -18, -16] as const).map((x): Vec3 => [x, 0, 17.6]),
  filaSlots: Array.from({ length: 8 }, (_, i): Vec3 => [-24, 0, 13.9 + i * 0.45]),
  mesas: ([-31, -25, -20, -15] as const).map((x) => ({
    pos: [x, 0, 15] as Vec3,
    lugares: [
      [x - 0.9, 0, 14.35],
      [x, 0, 14.35],
      [x + 0.9, 0, 14.35],
      [x - 0.9, 0, 15.65],
      [x, 0, 15.65],
      [x + 0.9, 0, 15.65],
    ] as Vec3[],
  })),
};

/**
 * Âncoras do pátio central:
 * - bancos: 4 bancos de jardim, cada um com 3 lugares;
 * - rodaConversa: 4 pontos de formação de grupos em pé;
 * - mastro: base do mastro da bandeira (0, 0, −5);
 * - canteiros: 4 canteiros de jardim (pos + dimensões);
 * - arvores: 6 árvores.
 * (Na expansão, o canteiro/árvore do canto sudeste do Bloco A saíram de
 * (28, −17) para (18, −17) e o banco sudoeste de (−20, 4) para (−16, 4),
 * liberando a projeção das escadas estendidas. Na integração (fase 3), o
 * canteiro/árvore sudoeste saíram de (−28, 6) para (−29,5; 7,5): a posição
 * antiga invadia ~1 m a projeção do lance 1 da escada B (x −26…−22); a nova
 * deixa ~0,5 m de folga tanto da escada quanto da fachada do Bloco C (x=−33),
 * sem encostar em bancos. Efeito colateral aceito: o nó de grade (−30, 9) do
 * pátio cai dentro do canteiro e deixa de existir — a grade 5×5 vizinha
 * mantém a conectividade (arestas por raio de 5,5 m).)
 */
export const PATIO = {
  bancos: (
    [
      [-20, -12],
      [20, -12],
      [-16, 4],
      [20, 4],
    ] as const
  ).map(([x, z]) => ({
    pos: [x, 0, z] as Vec3,
    lugares: [
      [x - 0.8, 0, z],
      [x, 0, z],
      [x + 0.8, 0, z],
    ] as Vec3[],
  })),
  rodaConversa: [
    [-12, 0, -8],
    [12, 0, -8],
    [-8, 0, 2],
    [10, 0, 3],
  ] as Vec3[],
  mastro: [0, 0, -5] as Vec3,
  canteiros: [
    { pos: [-28, 0, -17], w: 6, d: 2.5 },
    { pos: [18, 0, -17], w: 6, d: 2.5 },
    { pos: [-29.5, 0, 7.5], w: 6, d: 2.5 }, // sudoeste: afastado da escada B (ver nota acima)
    { pos: [28, 0, 6], w: 6, d: 2.5 },
  ],
  arvores: [
    [-28, 0, -17],
    [18, 0, -17],
    [-29.5, 0, 7.5], // acompanha o canteiro sudoeste (ver nota acima)
    [28, 0, 6],
    [-14, 0, -14],
    [14, 0, -14],
  ] as Vec3[],
};

/**
 * Âncoras da quadra poliesportiva (x +40…+70, z −15…+10; centro em (55, 0, −2,5)).
 * - traves: gols de futsal nas extremidades leste/oeste (boca voltada ao centro);
 * - tabelas: tabelas de basquete logo atrás de cada trave;
 * - areaBola: zona onde a bola de recreio circula (centro + raio).
 */
export const QUADRA = {
  rect: { x: 40, z: -15, w: 30, d: 25 } as RectXZ,
  centro: [55, 0, -2.5] as Vec3,
  traves: [
    { pos: [41.8, 0, -2.5] as Vec3, dir: [1, 0, 0] as Vec3 },
    { pos: [68.2, 0, -2.5] as Vec3, dir: [-1, 0, 0] as Vec3 },
  ],
  tabelas: [
    { pos: [43.5, 0, -2.5] as Vec3, dir: [1, 0, 0] as Vec3 },
    { pos: [66.5, 0, -2.5] as Vec3, dir: [-1, 0, 0] as Vec3 },
  ],
  areaBola: { centro: [55, 0, -2.5] as Vec3, raio: 12 },
};

/**
 * Âncoras da portaria:
 * - porteiroPos: posição do porteiro dentro da guarita;
 * - portao: centro do vão do portão no muro sul (z=+45) + largura (4 m);
 * - guarita: área da guarita (rect);
 * - spawnRua: 12 pontos na calçada/rua FORA do portão (z +48,5…+51),
 *   por onde os alunos entram e saem nas trocas de turno.
 */
export const PORTARIA = {
  porteiroPos: [-14.5, 0, 43.5] as Vec3,
  portao: { pos: [-20, 0, 45] as Vec3, largura: 4 },
  guarita: { x: -16, z: 42, w: 3, d: 3 } as RectXZ,
  spawnRua: [
    [-34, 0, 48.5],
    [-31, 0, 51],
    [-28, 0, 48.5],
    [-25, 0, 51],
    [-22, 0, 48.5],
    [-19, 0, 51],
    [-16, 0, 48.5],
    [-13, 0, 51],
    [-10, 0, 48.5],
    [-7, 0, 51],
    [-4, 0, 48.5],
    [-1, 0, 51],
  ] as Vec3[],
};

/**
 * Âncoras dos espaços administrativos do térreo do Bloco B:
 * mesa da diretora, balcão/mesa da secretaria e as 4 mesas da Coordenação
 * Pedagógica (antiga sala dos professores do Bloco B — os professores
 * agora usam a SALA_PROFESSORES_GRANDE do Bloco C).
 */
export const ADMIN = {
  diretoriaMesa: [9, 0, 17.5] as Vec3,
  secretariaMesa: [1, 0, 16] as Vec3,
  profMesas: [
    [15, 0, 15.5],
    [19, 0, 15.5],
    [15, 0, 18.5],
    [19, 0, 18.5],
  ] as Vec3[],
};

/**
 * Âncoras do auditório (1º andar do Bloco B):
 * - palco: rect elevado (0,4 m) junto à parede sul, com espaço p/ cortina;
 * - cadeiras: 3 fileiras × 18 cadeiras voltadas ao palco (y = piso do pavimento).
 */
export const AUDITORIO = {
  palco: { x: -28, z: 17.5, w: 22, d: 2.2 } as RectXZ,
  cadeiras: (() => {
    const out: Vec3[] = [];
    for (let f = 0; f < 3; f++) {
      for (let c = 0; c < 18; c++) {
        out.push([-27.5 + c * 1.2, 3, 14 + f * 1.1]);
      }
    }
    return out;
  })(),
};

/**
 * Âncoras do ALMOXARIFADO (térreo do Bloco C, z −16…−6):
 * - mesa: centro do tampo do balcão de atendimento (x −42…−38, z ~−10);
 * - posMaquina: base da máquina Fill (GLB) sobre a mesa (altura do tampo 0,9);
 * - postoAlmoxarife: posição fixa do almoxarife, atrás da mesa;
 * - fila: 6 posições à frente da mesa, da máquina em direção à porta;
 * - porta: vão de entrada na parede x=−36 (de frente para o corredor).
 */
export const ALMOXARIFADO = {
  mesa: [-40, 0, -10] as Vec3,
  posMaquina: [-40, 0.9, -10] as Vec3,
  postoAlmoxarife: [-40, 0, -11.2] as Vec3,
  fila: [
    [-38.6, 0, -9.4],
    [-38.1, 0, -9.4],
    [-37.6, 0, -9.4],
    [-37.1, 0, -9.4],
    [-36.6, 0, -9.4],
    [-36.1, 0, -9.4],
  ] as Vec3[],
  porta: { x: -36, z: -11, largura: 1.2, eixo: 'z' } as VaoPorta,
};

/**
 * Âncoras da SALA DOS PROFESSORES GRANDE (térreo do Bloco C, z +2…+20):
 * 8 mesas × 5 lugares = 40 lugares (≥ 32 exigidos pela SPEC).
 * `mesas` = centros dos tampos (y = piso); `lugares` = centros dos assentos.
 */
export const SALA_PROFESSORES_GRANDE = (() => {
  const mesas: Vec3[] = [];
  const lugares: Vec3[] = [];
  for (const z of [8, 14]) {
    for (const x of [-43.5, -41.5, -39.5, -37.5]) {
      mesas.push([x, 0, z]);
      lugares.push(
        [x - 0.8, 0, z - 0.6],
        [x, 0, z - 0.6],
        [x + 0.8, 0, z - 0.6],
        [x - 0.8, 0, z + 0.6],
        [x + 0.8, 0, z + 0.6],
      );
    }
  }
  return { mesas, lugares };
})();

// ---------------------------------------------------------------------------
// Objeto agregador
// ---------------------------------------------------------------------------

/**
 * Agregado de todo o layout (além dos exports nomeados individuais acima).
 * Útil para importar tudo de uma vez: `import { LAYOUT } from '.../contracts'`.
 */
export const LAYOUT = {
  CONST,
  TERRENO,
  SALAS,
  getSala,
  WALLS,
  STAIRS,
  alturaNaRampa,
  CORREDOR_SPINES,
  IDS_SALAS_AULA,
  CARTEIRAS,
  QUADROS,
  MESAS_PROFESSOR,
  REFEITORIO,
  PATIO,
  QUADRA,
  PORTARIA,
  ADMIN,
  AUDITORIO,
  ALMOXARIFADO,
  SALA_PROFESSORES_GRANDE,
} as const;
