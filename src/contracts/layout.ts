/**
 * layout.ts — GEOGRAFIA FÍSICA COMPLETA da escola (fonte única da verdade).
 *
 * Unidade = metros, Y-up, origem (0,0,0) no centro do pátio.
 * Piso térreo y=0 · laje intermediária y=3 · telhado sobre y=6.
 *
 * MAPA GERAL (visto de cima; norte = Z negativo, sul = Z positivo):
 *
 *        x:  -62 ............................................... +78
 *   z=-47,5 ── MURO NORTE ─────────────────────────────────────────────
 *            ┌── BLOCO A (z −32…−20, x −33…+33) ─┐   2 pisos
 *            │ salas 1–6 (térreo) / 7–12 (superior), cada ~11×9 (z −32…−23)
 *            │ corredor térreo interno z −23…−20 (3 m), 3 saídas p/ o pátio
 *            │ varanda superior aberta z −23…−20 c/ guarda-corpo em z=−20
 *            └──────────────────────────────────┘
 *      PÁTIO CENTRAL (z −20…+10): bancos, árvores, canteiros, mastro (0,0,−5)
 *      escada principal (Bloco A): x 26…30, base z=−6 → topo z=−20
 *      escada secundária (Bloco B): x −25,5…−22,5, base z=+2 → topo z=+10
 *            ┌── BLOCO B (z +10…+20, x −29…+29) ─┐    2 pisos
 *            │ térreo (z +13…+20): Refeitório x −29…−11 · Banheiros M x −11…−7,
 *            │   F x −7…−3 · Secretaria x −3…+5 · Diretoria x +5…+13 ·
 *            │   Sala dos Professores x +13…+21 · Biblioteca x +21…+29
 *            │ superior: Auditório x −29…−5 · Laboratório x −5…+11 · Artes x +11…+29
 *            │ passeio coberto térreo z +10…+13 (aberto) · varanda superior z +10…+13
 *            └──────────────────────────────────┘
 *   QUADRA (x +40…+70, z −15…+10) a leste, com alambrado (2 vãos no lado oeste)
 *   z=+45 ── MURO SUL: portão x −22…−18 (4 m), guarita x −16…−13, z +42…+45 ──
 *   RUA/calçada: z > +45 (spawn dos alunos em spawnRua)
 *
 * CONVENÇÃO DOS WALLS (paredes): lista final de AABBs SÓLIDOS já com os
 * vãos de porta/janela recortados (cada vão vira segmentos laterais + peitoril
 * e/ou verga). Serve tanto para RENDERIZAÇÃO (1 Box por AABB) quanto para
 * COLISÃO. Espessuras: paredes 0,2 m · muros 0,3 m · alambrado 0,1 m.
 * Alturas dos vãos: portas 0→2,1 (duplas 0→2,3) · janelas 1,0→2,2
 * (banheiros 1,6→2,2) · portão da rua: vão total · saídas do corredor A: 0→2,4.
 */

import type { AABB, Andar, RectXZ, SalaDef, Vec3 } from './types';

// ---------------------------------------------------------------------------
// Constantes globais
// ---------------------------------------------------------------------------

export const CONST = {
  /** Altura de um pavimento (pé-direito) — laje do andar 1 em y=3. */
  ALTURA_PISO: 3,
  PE_DIREITO: 3,
  /** Base do telhado (topo do 2º pavimento). */
  ALTURA_TELHADO: 6,
  /** Escala de tempo do jogo: 10 s de jogo por 1 s real. */
  ESCALA_TEMPO: 10,
  /** Minutos desde 00:00 da abertura do portão (7h00). */
  HORA_ABERTURA: 7 * 60,
  /** Minutos desde 00:00 do fechamento (12h00) — o relógio para aí. */
  HORA_FECHAMENTO: 12 * 60,
  /** Velocidades em m/s (jogo). */
  VEL_PASSEIO: 1.2,
  VEL_ANDAR: 1.7,
  VEL_CORRER: 3.4,
  VEL_JOGADOR: 4.5,
  /** Total de personagens (== ROSTER.length; duplicado aqui p/ buffers). */
  TOTAL_PERSONAGENS: 79,
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

function salaDeAula(i: number, andar: Andar): SalaDef {
  // Salas 1–6 no térreo do Bloco A; 7–12 no superior. Cada uma 11×9 m,
  // x = −33+11·(i−1) … −22+11·(i−1), z = −32…−23. Porta para o corredor/varanda
  // na parede sul da sala (z=−23); 2 janelas na parede norte (z=−32).
  const n = andar === 0 ? i + 1 : i + 7;
  const x0 = -33 + 11 * i;
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
    corDestaque: AULAS_CORES[n - 1],
  };
}

export const SALAS: SalaDef[] = [
  // --- Bloco A: 12 salas de aula ---
  ...[0, 1, 2, 3, 4, 5].map((i) => salaDeAula(i, 0)),
  ...[0, 1, 2, 3, 4, 5].map((i) => salaDeAula(i, 1)),

  // --- Bloco B, térreo (z +13…+20; portas voltadas ao pátio, parede z=+13) ---
  {
    id: 'refeitorio',
    nome: 'Refeitório / Cantina',
    tipo: 'refeitorio',
    andar: 0,
    rect: { x: -29, z: 13, w: 18, d: 7 },
    altura: CONST.PE_DIREITO,
    portas: [{ x: -20, z: 13, largura: 2.0, eixo: 'x' }],
    janelas: [
      { x: -26.2, z: 13, largura: 1.6, eixo: 'x' },
      { x: -14.2, z: 13, largura: 1.6, eixo: 'x' },
      { x: -26.2, z: 20, largura: 1.6, eixo: 'x' },
      { x: -14.2, z: 20, largura: 1.6, eixo: 'x' },
    ],
    corDestaque: '#f4a261',
  },
  {
    id: 'banheiro-m',
    nome: 'Banheiro Masculino',
    tipo: 'banheiro',
    andar: 0,
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
    andar: 0,
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
    andar: 0,
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
    andar: 0,
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
    id: 'sala-professores',
    nome: 'Sala dos Professores',
    tipo: 'salaProfessores',
    andar: 0,
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
    andar: 0,
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

  // --- Bloco B, superior (andar 1) ---
  {
    id: 'auditorio',
    nome: 'Auditório',
    tipo: 'auditorio',
    andar: 1,
    rect: { x: -29, z: 13, w: 24, d: 7 },
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
    andar: 1,
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
    andar: 1,
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
  // ===== BLOCO A (x −33…+33, z −32…−20) =====
  // Parede norte (z=−32), térreo e superior — recebe as janelas das salas.
  { eixo: 'x', fixo: -32, de: -33, ate: 33, yBase: 0, altura: 3, vaos: [] },
  { eixo: 'x', fixo: -32, de: -33, ate: 33, yBase: 3, altura: 3, vaos: [] },
  // Parede salas↔corredor/varanda (z=−23) — recebe as portas das salas.
  { eixo: 'x', fixo: -23, de: -33, ate: 33, yBase: 0, altura: 3, vaos: [] },
  { eixo: 'x', fixo: -23, de: -33, ate: 33, yBase: 3, altura: 3, vaos: [] },
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
  // Guarda-corpo da varanda do Bloco A (z=−20), vão da escada principal x 26…30.
  {
    eixo: 'x',
    fixo: -20,
    de: -33,
    ate: 33,
    yBase: 3,
    altura: 1.1,
    vaos: [{ de: 26, ate: 30, yDe: 0, yAte: 1.1 }],
  },
  // Divisórias entre as salas do Bloco A (ambos os andares).
  ...[-22, -11, 0, 11, 22].flatMap((x): SpanMuro[] => [
    { eixo: 'z', fixo: x, de: -32, ate: -23, yBase: 0, altura: 3, vaos: [] },
    { eixo: 'z', fixo: x, de: -32, ate: -23, yBase: 3, altura: 3, vaos: [] },
  ]),
  // Laterais do Bloco A (x=±33): térreo com 1 janela; superior = parede + guarda-corpo da varanda.
  ...[-33, 33].flatMap((x): SpanMuro[] => [
    {
      eixo: 'z',
      fixo: x,
      de: -32,
      ate: -20,
      yBase: 0,
      altura: 3,
      vaos: [{ de: -27, ate: -25.4, yDe: 1.0, yAte: 2.2 }],
    },
    {
      eixo: 'z',
      fixo: x,
      de: -32,
      ate: -23,
      yBase: 3,
      altura: 3,
      vaos: [{ de: -27, ate: -25.4, yDe: 1.0, yAte: 2.2 }],
    },
    { eixo: 'z', fixo: x, de: -23, ate: -20, yBase: 3, altura: 1.1, vaos: [] },
  ]),

  // ===== BLOCO B (x −29…+29, z +10…+20; cômodos z +13…+20) =====
  // Parede norte dos cômodos (z=+13) — recebe portas e janelas, ambos os andares.
  { eixo: 'x', fixo: 13, de: -29, ate: 29, yBase: 0, altura: 3, vaos: [] },
  { eixo: 'x', fixo: 13, de: -29, ate: 29, yBase: 3, altura: 3, vaos: [] },
  // Parede sul (z=+20, fachada da rua, onde fica o letreiro) — recebe janelas.
  { eixo: 'x', fixo: 20, de: -29, ate: 29, yBase: 0, altura: 3, vaos: [] },
  { eixo: 'x', fixo: 20, de: -29, ate: 29, yBase: 3, altura: 3, vaos: [] },
  // Divisórias do térreo (refeitório|banh.M|banh.F|secretaria|diretoria|prof.|biblioteca).
  ...[-11, -7, -3, 5, 13, 21].map(
    (x): SpanMuro => ({ eixo: 'z', fixo: x, de: 13, ate: 20, yBase: 0, altura: 3, vaos: [] }),
  ),
  // Divisórias do superior (auditório|laboratório|artes).
  ...[-5, 11].map(
    (x): SpanMuro => ({ eixo: 'z', fixo: x, de: 13, ate: 20, yBase: 3, altura: 3, vaos: [] }),
  ),
  // Laterais do Bloco B (x=±29): parede c/ janela (ambos os andares) + guarda-corpo da varanda.
  ...[-29, 29].flatMap((x): SpanMuro[] => [
    {
      eixo: 'z',
      fixo: x,
      de: 13,
      ate: 20,
      yBase: 0,
      altura: 3,
      vaos: [{ de: 15.7, ate: 17.3, yDe: 1.0, yAte: 2.2 }],
    },
    {
      eixo: 'z',
      fixo: x,
      de: 13,
      ate: 20,
      yBase: 3,
      altura: 3,
      vaos: [{ de: 15.7, ate: 17.3, yDe: 1.0, yAte: 2.2 }],
    },
    { eixo: 'z', fixo: x, de: 10, ate: 13, yBase: 3, altura: 1.1, vaos: [] },
  ]),
  // Guarda-corpo da varanda do Bloco B (z=+10), vão da escada secundária x −25,5…−22,5.
  {
    eixo: 'x',
    fixo: 10,
    de: -29,
    ate: 29,
    yBase: 3,
    altura: 1.1,
    vaos: [{ de: -25.5, ate: -22.5, yDe: 0, yAte: 1.1 }],
  },

  // ===== MUROS DO TERRENO (esp 0,3; altura 2,2) =====
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

  // ===== GUARITA DO PORTEIRO (x −16…−13, z +42…+45, altura 2,6; encostada no muro sul) =====
  // Norte (z=+42) com a porta de 0,9 m; oeste (x=−16) com janela p/ o portão;
  // leste (x=−13) cega; o lado sul é o próprio muro.
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

  // ===== ALAMBRADO DA QUADRA (x +40…+70, z −15…+10; esp 0,1; altura 3) =====
  // Dois vãos de entrada no lado oeste (voltados ao pátio): z −6…−2 e z +4…+7.
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
 * Lista final de paredes/muros/guarda-corpos/balcão como AABBs sólidos
 * (vãos já recortados). Última entrada: balcão da cantina (x −27…−14, z ~17,
 * altura 1,1; a passagem para a cozinha é o vão x −14…−12 junto à divisória).
 */
export const WALLS: AABB[] = [
  ...SPANS.flatMap(spanParaAABBs),
  { min: [-27, 0, 16.9], max: [-14, 1.1, 17.1] }, // balcão da cantina
];

// ---------------------------------------------------------------------------
// Escadarias (STAIRS)
// ---------------------------------------------------------------------------

export interface StairDef {
  id: string;
  /** Ponto central da base da rampa (nível do pátio, y=0). */
  base: Vec3;
  /** Ponto central do topo da rampa (nível da varanda, y=3). */
  topo: Vec3;
  /** Largura útil da escada (ao longo do eixo perpendicular a `dir`). */
  largura: number;
  /** Ponto central do patamar intermediário. */
  patamar: Vec3;
  /** Direção horizontal de subida (normalizada, y=0). */
  dir: Vec3;
}

export const STAIRS: StairDef[] = [
  {
    // Escadaria PRINCIPAL (4 m) do Bloco A: sobe do pátio (z=−6) para o norte
    // até a varanda (z=−20). Projeção no chão: x 26…30, z −20…−6.
    id: 'escada-a',
    base: [28, 0, -6],
    topo: [28, 3, -20],
    largura: 4,
    patamar: [28, 1.5, -13],
    dir: [0, 0, -1],
  },
  {
    // Escadaria SECUNDÁRIA (3 m) do Bloco B: sobe do pátio (z=+2) para o sul
    // até a varanda (z=+10). Projeção no chão: x −25,5…−22,5, z +2…+10.
    id: 'escada-b',
    base: [-24, 0, 2],
    topo: [-24, 3, 10],
    largura: 3,
    patamar: [-24, 1.5, 6],
    dir: [0, 0, 1],
  },
];

/**
 * Altura y do piso da rampa da escada no ponto (x, z).
 * Interpolação linear por trechos base→patamar→topo (contínua).
 * Retorna `null` quando (x, z) está fora da projeção da escada
 * (com margem de 0,3 m) — use isso para colisão/subida de jogador e NPCs.
 */
export function alturaNaRampa(stair: StairDef, x: number, z: number): number | null {
  const dx = stair.dir[0];
  const dz = stair.dir[2];
  // Comprimentos horizontais dos trechos.
  const seg1 =
    (stair.patamar[0] - stair.base[0]) * dx + (stair.patamar[2] - stair.base[2]) * dz;
  const seg2 =
    (stair.topo[0] - stair.patamar[0]) * dx + (stair.topo[2] - stair.patamar[2]) * dz;
  const total = seg1 + seg2;
  // Projeção do ponto no eixo da escada.
  const along = (x - stair.base[0]) * dx + (z - stair.base[2]) * dz;
  // Distância lateral ao eixo.
  const lat = Math.abs((x - stair.base[0]) * -dz + (z - stair.base[2]) * dx);
  if (lat > stair.largura / 2 + 0.3 || along < -0.3 || along > total + 0.3) return null;
  const t = Math.min(Math.max(along, 0), total);
  if (t <= seg1) {
    const k = seg1 === 0 ? 0 : t / seg1;
    return stair.base[1] + (stair.patamar[1] - stair.base[1]) * k;
  }
  const k = seg2 === 0 ? 0 : (t - seg1) / seg2;
  return stair.patamar[1] + (stair.topo[1] - stair.patamar[1]) * k;
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
 * - corredor-a-0: corredor térreo interno do Bloco A (z=−21,5);
 * - varanda-a-1: varanda superior do Bloco A (z=−21,5);
 * - passeio-b-0: passeio coberto térreo do Bloco B (z=+11,5);
 * - varanda-b-1: varanda superior do Bloco B (z=+11,5).
 */
export const CORREDOR_SPINES: CorredorSpine[] = [
  { id: 'corredor-a-0', andar: 0, de: [-31, 0, -21.5], ate: [31, 0, -21.5] },
  { id: 'varanda-a-1', andar: 1, de: [-31, 3, -21.5], ate: [31, 3, -21.5] },
  { id: 'passeio-b-0', andar: 0, de: [-27, 0, 11.5], ate: [27, 0, 11.5] },
  { id: 'varanda-b-1', andar: 1, de: [-27, 3, 11.5], ate: [27, 3, 11.5] },
];

// ---------------------------------------------------------------------------
// Âncoras de mobiliário (posições exatas usadas por arquitetura E pela IA)
// ---------------------------------------------------------------------------

/** Ids das 12 salas de aula, em ordem. */
export const IDS_SALAS_AULA = SALAS.filter((s) => s.tipo === 'aula').map((s) => s.id);

/**
 * Carteiras dos alunos por sala de aula: grade 6 colunas × 5 fileiras = 30
 * lugares, com corredor central no eixo da porta. Orientadas ao quadro
 * (parede norte, z=−32). Posições = centro do ASSENTO (y = piso do andar).
 */
export const CARTEIRAS: Record<string, Vec3[]> = Object.fromEntries(
  IDS_SALAS_AULA.map((id) => {
    const sala = getSala(id);
    const cx = sala.rect.x + sala.rect.w / 2;
    const y = sala.andar * CONST.ALTURA_PISO;
    const colunas = [-4.2, -2.5, -0.9, 0.9, 2.5, 4.2];
    const fileiras = [-29.8, -28.5, -27.2, -25.9, -24.6];
    const lugares: Vec3[] = [];
    for (const z of fileiras) {
      for (const dx of colunas) {
        lugares.push([cx + dx, y, z]);
      }
    }
    return [id, lugares];
  }),
);

/**
 * Quadro de cada sala de aula: centro na parede norte (z=−31,85),
 * `normal` apontando para dentro da sala (+Z). `pos` já tem a altura do centro
 * do quadro (1,6 m acima do piso do andar).
 */
export const QUADROS: Record<string, { pos: Vec3; normal: Vec3 }> = Object.fromEntries(
  IDS_SALAS_AULA.map((id) => {
    const sala = getSala(id);
    const cx = sala.rect.x + sala.rect.w / 2;
    const y = sala.andar * CONST.ALTURA_PISO;
    return [id, { pos: [cx, y + 1.6, -31.85] as Vec3, normal: [0, 0, 1] as Vec3 }];
  }),
);

/** Mesa do professor em cada sala de aula (centro do tampo, y = piso). */
export const MESAS_PROFESSOR: Record<string, Vec3> = Object.fromEntries(
  IDS_SALAS_AULA.map((id) => {
    const sala = getSala(id);
    const cx = sala.rect.x + sala.rect.w / 2;
    const y = sala.andar * CONST.ALTURA_PISO;
    return [id, [cx, y, -30.6] as Vec3];
  }),
);

/**
 * Âncoras do refeitório/cantina:
 * - balcao: 6 pontos de serviço ATRÁS do balcão (lado da cozinha, z=17,6),
 *   onde as cozinheiras ficam;
 * - filaSlots: 8 posições em fila única à FRENTE do balcão (a 1ª é a ponta,
 *   a última é quem está sendo servido);
 * - mesas: 3 mesas comunitárias, cada uma com 6 lugares (3 por lado).
 */
export const REFEITORIO = {
  balcao: ([-26, -24, -22, -20, -18, -16] as const).map((x): Vec3 => [x, 0, 17.6]),
  filaSlots: Array.from({ length: 8 }, (_, i): Vec3 => [-24, 0, 13.9 + i * 0.45]),
  mesas: ([-25, -20, -15] as const).map((x) => ({
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
 */
export const PATIO = {
  bancos: (
    [
      [-20, -12],
      [20, -12],
      [-20, 4],
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
    { pos: [28, 0, -17], w: 6, d: 2.5 },
    { pos: [-28, 0, 6], w: 6, d: 2.5 },
    { pos: [28, 0, 6], w: 6, d: 2.5 },
  ],
  arvores: [
    [-28, 0, -17],
    [28, 0, -17],
    [-28, 0, 6],
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
 *   por onde os alunos entram de manhã e saem no fim das aulas.
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
 * mesa da diretora, balcão/mesa da secretaria e 4 mesas da sala dos professores.
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
 * Âncoras do auditório (andar 1 do Bloco B):
 * - palco: rect elevado (0,4 m) junto à parede sul, com espaço p/ cortina;
 * - cadeiras: 3 fileiras × 18 cadeiras voltadas ao palco (y = piso do andar).
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
} as const;
