/**
 * waypoints.ts — GRAFO DE NAVEGAÇÃO da escola (fonte única para a IA de NPCs
 * e para o jogador). Gerado PROGRAMATICAMENTE a partir de layout.ts:
 *
 * EXPANSÃO (escola em U, 3 blocos × 4 pavimentos — ver docs/SPEC.md e layout.ts):
 * - Para cada uma das 44 salas/cômodos (incl. o almoxarifado e a sala dos
 *   professores grande do Bloco C): nó central + nó de porta "int" (dentro)
 *   e "ext" (fora), com arestas explícitas centro↔int↔ext.
 * - Espinha dos corredores/varandas (CORREDOR_SPINES: 12 linhas — blocos A,
 *   B e C nos 4 pavimentos): nós a cada ~4 m.
 * - Portas de ligação C↔A (z=−21,5) e C↔B (z=+11,5) nos 4 pavimentos: par de
 *   nós oeste/leste + aresta explícita (as espinhas não se ligam sozinhas —
 *   a reta entre elas cruza a parede compartilhada FORA do vão).
 * - Escadas (3, de 3 lances em meia-volta): cadeia explícita de nós
 *   base → saída/pé de cada lance → topo (é o que liga o térreo ao 3º andar),
 *   mais patamar e, nas escadas A/B, a passarela y=6 até a varanda do 2º
 *   andar. Posições derivadas de `lances`/`patamares` do StairDef (a leitura
 *   de altura por ponto é feita por `alturaNaRampa` com `yRef`, que desambigua
 *   os lances 1 e 3, sobrepostos em planta).
 * - Nós manuais: grade do pátio (5×5 m, x −30…+30), contornos leste/oeste,
 *   espinha do quintal sul, portão/guarita/rua, quadra, fila do refeitório
 *   e fila do almoxarifado.
 *
 * ARESTAS: (1) automáticas — pares de nós no MESMO ANDAR, com Δy ≤ 1 m e
 * distância EM PLANTA ≤ 5,5 m, cuja linha reta NÃO cruza nenhum AABB de
 * WALLS na altura do torso (andar·3 + 1,0 m); nós do tipo 'escada' ficam
 * fora do automático; (2) explícitas — portas de salas, cadeias das escadas,
 * ligações C↔A/C↔B e ligações escada↔piso. O Δy + a distância em planta
 * impedem arestas automáticas entre pavimentos (há nós sobrepostos em XZ).
 *
 * Custam 500 nós e 878 arestas; a construção ocorre uma vez na carga do módulo.
 */

import type { Andar, Vec3 } from './types';
import {
  ALMOXARIFADO,
  CONST,
  CORREDOR_SPINES,
  PATIO,
  PORTARIA,
  REFEITORIO,
  SALAS,
  STAIRS,
  WALLS,
  alturaNaRampa,
  type StairDef,
} from './layout';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TipoWaypoint =
  | 'corredor'
  | 'porta'
  | 'patio'
  | 'escada'
  | 'quadra'
  | 'refeitorio'
  | 'sala'
  | 'portao'
  | 'rua'
  | 'admin';

export interface WaypointNode {
  id: string;
  pos: Vec3;
  andar: Andar;
  tipo: TipoWaypoint;
  /** Presente em nós pertencentes a uma sala (centro e porta-int). */
  salaId?: string;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Teste de linha livre contra WALLS (2D no plano XZ + faixa de altura)
// ---------------------------------------------------------------------------

/** Interseção segmento × retângulo (método dos slabs). */
function segCruzaRect(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  minx: number,
  minz: number,
  maxx: number,
  maxz: number,
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-9) {
    if (ax < minx || ax > maxx) return false;
  } else {
    let ta = (minx - ax) / dx;
    let tb = (maxx - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (az < minz || az > maxz) return false;
  } else {
    let ta = (minz - az) / dz;
    let tb = (maxz - az) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

/** true se a linha reta a→b (no andar indicado) cruza alguma parede sólida. */
export function cruzaParede(a: Vec3, b: Vec3, andar: Andar): boolean {
  const yTorso = andar * CONST.ALTURA_PISO + 1.0;
  for (const w of WALLS) {
    if (w.min[1] < yTorso && w.max[1] > yTorso) {
      if (segCruzaRect(a[0], a[2], b[0], b[2], w.min[0], w.min[2], w.max[0], w.max[2])) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Construção dos nós
// ---------------------------------------------------------------------------

const nos: WaypointNode[] = [];
const arestasExplicitas: [number, number][] = [];

function addNo(n: WaypointNode): number {
  nos.push(n);
  return nos.length - 1;
}

/** Distância 3D entre posições. */
function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Distância em planta (XZ) entre posições. */
function distPlanta(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

/** Andar (0–3) correspondente a uma cota y (lajes em 0, 3, 6, 9). */
function andarDeY(y: number): Andar {
  return Math.round(y / CONST.ALTURA_PISO) as Andar;
}

function tipoNoDaSala(tipo: string): TipoWaypoint {
  if (tipo === 'aula') return 'sala';
  if (tipo === 'refeitorio') return 'refeitorio';
  if (tipo === 'secretaria' || tipo === 'diretoria' || tipo === 'salaProfessores') return 'admin';
  return 'sala'; // biblioteca, banheiros, auditório, lab, artes
}

// --- 1) Salas: centro + portas (dentro/fora) ---
for (const sala of SALAS) {
  const y = sala.andar * CONST.ALTURA_PISO;
  const cx = sala.rect.x + sala.rect.w / 2;
  const cz = sala.rect.z + sala.rect.d / 2;
  const idxCentro = addNo({
    id: `${sala.id}-centro`,
    pos: [cx, y, cz],
    andar: sala.andar,
    tipo: tipoNoDaSala(sala.tipo),
    salaId: sala.id,
  });
  sala.portas.forEach((porta, j) => {
    // Dentro = em direção ao centro da sala; fora = lado oposto.
    const sinal = porta.eixo === 'x' ? Math.sign(cz - porta.z) : Math.sign(cx - porta.x);
    const dentro: Vec3 =
      porta.eixo === 'x'
        ? [porta.x, y, porta.z + sinal * 0.6]
        : [porta.x + sinal * 0.6, y, porta.z];
    const fora: Vec3 =
      porta.eixo === 'x'
        ? [porta.x, y, porta.z - sinal * 0.6]
        : [porta.x - sinal * 0.6, y, porta.z];
    const idxInt = addNo({
      id: `${sala.id}-porta-${j}-int`,
      pos: dentro,
      andar: sala.andar,
      tipo: 'porta',
      salaId: sala.id,
    });
    const idxExt = addNo({
      id: `${sala.id}-porta-${j}-ext`,
      pos: fora,
      andar: sala.andar,
      tipo: 'porta',
    });
    arestasExplicitas.push([idxCentro, idxInt], [idxInt, idxExt]);
  });
}

// --- 2) Saídas térreas dos blocos para o pátio ---
// Bloco A: 3 saídas do corredor térreo (vãos de 2,4 m na parede z=−20).
for (const [i, x] of [-16.5, 0, 16.5].entries()) {
  addNo({
    id: `saida-corredor-a-${i}`,
    pos: [x, 0, -19.2],
    andar: 0,
    tipo: 'porta',
    tags: ['saida-corredor'],
  });
}
// Bloco C: 2 portas da fachada leste (x=−33) para o pátio, em frente ao
// almoxarifado (z=−11) e à sala dos professores (z=+8).
for (const [i, z] of [-11, 8].entries()) {
  addNo({
    id: `saida-corredor-c-${i}`,
    pos: [-32.2, 0, z],
    andar: 0,
    tipo: 'porta',
    tags: ['saida-corredor'],
  });
}

// --- 3) Espinhas dos corredores/varandas (nó a cada ~4 m) ---
for (const spine of CORREDOR_SPINES) {
  const comp = dist(spine.de, spine.ate);
  const segmentos = Math.max(1, Math.ceil(comp / 4));
  for (let i = 0; i <= segmentos; i++) {
    const t = i / segmentos;
    addNo({
      id: `sp-${spine.id}-${i}`,
      pos: [
        spine.de[0] + (spine.ate[0] - spine.de[0]) * t,
        spine.de[1] + (spine.ate[1] - spine.de[1]) * t,
        spine.de[2] + (spine.ate[2] - spine.de[2]) * t,
      ],
      andar: spine.andar,
      tipo: 'corredor',
    });
  }
}

// --- 4) Portas de ligação entre o Bloco C e os blocos A/B ---
// Vãos na parede compartilhada x=−33 em TODOS os pavimentos: C↔A centrado em
// z=−21,5 (vão −22,1…−20,9) e C↔B centrado em z=+11,5 (vão +10,9…+12,1).
// As espinhas dos corredores não se ligam sozinhas (a reta entre elas cruza
// a parede fora do vão), então cada passagem ganha um par de nós oeste/leste
// + aresta explícita; as pontas se ligam às espinhas por aresta automática.
const ANDARES: Andar[] = [0, 1, 2, 3];
for (const andar of ANDARES) {
  const y = andar * CONST.ALTURA_PISO;
  for (const [nome, z] of [
    ['ca', -21.5],
    ['cb', 11.5],
  ] as const) {
    const oeste = addNo({
      id: `ligacao-${nome}-${andar}-oeste`,
      pos: [-33.7, y, z],
      andar,
      tipo: 'porta',
      tags: ['ligacao-blocos'],
    });
    const leste = addNo({
      id: `ligacao-${nome}-${andar}-leste`,
      pos: [-32.3, y, z],
      andar,
      tipo: 'porta',
      tags: ['ligacao-blocos'],
    });
    arestasExplicitas.push([oeste, leste]);
  }
}

// --- 5) Escadas: cadeia base → lances → topo + patamar + passarela ---
// Para cada lance i: nó de SAÍDA no pavimento de chegada (`-l{i}-topo`, 0,4 m
// adiante do topo) e, para i ≥ 1, nó de PÉ no pavimento de partida
// (`-l{i}-base`, 0,4 m recuado da base). A cadeia explícita
// base→l0-topo→l1-base→l1-topo→l2-base→topo é o que liga o térreo ao 3º
// andar. Os ids `-base`/`-patamar`/`-topo` são mantidos (compat).
interface NosEscada {
  stair: StairDef;
  base: number;
  l0Topo: number;
  l1Base: number;
  l1Topo: number;
  l2Base: number;
  topo: number;
  patamar: number;
  /** Último nó da passarela (junto à varanda do 2º andar); −1 se não houver. */
  passarelaFim: number;
}
const idxEscadaPorStair: NosEscada[] = [];

for (const stair of STAIRS) {
  const [l0, l1, l2] = stair.lances;
  const addEscada = (id: string, pos: Vec3): number =>
    addNo({ id, pos, andar: andarDeY(pos[1]), tipo: 'escada' });
  const base = addEscada(`${stair.id}-base`, [
    l0.base[0] - l0.dir[0] * 0.6,
    l0.base[1],
    l0.base[2] - l0.dir[2] * 0.6,
  ]);
  const l0Topo = addEscada(`${stair.id}-l0-topo`, [
    l0.topo[0] + l0.dir[0] * 0.4,
    l0.topo[1],
    l0.topo[2] + l0.dir[2] * 0.4,
  ]);
  const l1Base = addEscada(`${stair.id}-l1-base`, [
    l1.base[0] - l1.dir[0] * 0.4,
    l1.base[1],
    l1.base[2] - l1.dir[2] * 0.4,
  ]);
  const l1Topo = addEscada(`${stair.id}-l1-topo`, [
    l1.topo[0] + l1.dir[0] * 0.4,
    l1.topo[1],
    l1.topo[2] + l1.dir[2] * 0.4,
  ]);
  const l2Base = addEscada(`${stair.id}-l2-base`, [
    l2.base[0] - l2.dir[0] * 0.4,
    l2.base[1],
    l2.base[2] - l2.dir[2] * 0.4,
  ]);
  const topo = addEscada(`${stair.id}-topo`, [
    l2.topo[0] + l2.dir[0] * 0.4,
    l2.topo[1],
    l2.topo[2] + l2.dir[2] * 0.4,
  ]);
  // Patamar principal (posição `patamar` do contrato; na escada C é um ponto
  // da laje do 1º andar, pois a escada interna não tem patamar flutuante).
  const patamar = addEscada(`${stair.id}-patamar`, [...stair.patamar]);
  // Cadeia principal: térreo → 3º andar.
  arestasExplicitas.push(
    [base, l0Topo],
    [l0Topo, l1Base],
    [l1Base, l1Topo],
    [l1Topo, l2Base],
    [l2Base, topo],
  );
  // O patamar vira "hub" dos nós de lance que estão no MESMO nível dele
  // (escadas A/B: l1-topo e l2-base em y=6; escada C: l0-topo e l1-base em y=3).
  for (const idx of [l0Topo, l1Base, l1Topo, l2Base]) {
    if (nos[idx].pos[1] === stair.patamar[1]) arestasExplicitas.push([patamar, idx]);
  }
  // Passarela flutuante (`patamares[1]`) do patamar até a varanda do 2º andar
  // (escadas A e B; a escada C não tem — o 2º andar é a laje do hall).
  let passarelaFim = -1;
  const pass = stair.patamares[1];
  if (pass) {
    const cx = pass.rect.x + pass.rect.w / 2;
    const zA = pass.rect.z;
    const zB = pass.rect.z + pass.rect.d;
    const zCentroPatamar = stair.patamares[0].rect.z + stair.patamares[0].rect.d / 2;
    // zPerto = extremo da passarela junto ao patamar; zLonge = extremo na varanda.
    const [zPerto, zLonge] =
      Math.abs(zA - zCentroPatamar) < Math.abs(zB - zCentroPatamar) ? [zA, zB] : [zB, zA];
    const sentido = Math.sign(zLonge - zPerto);
    const p0 = addEscada(`${stair.id}-pass-0`, [cx, pass.y, zPerto]);
    const p1 = addEscada(`${stair.id}-pass-1`, [cx, pass.y, (zPerto + zLonge) / 2]);
    const p2 = addEscada(`${stair.id}-pass-2`, [cx, pass.y, zLonge + sentido * 0.4]);
    arestasExplicitas.push([patamar, p0], [p0, p1], [p1, p2]);
    passarelaFim = p2;
  }
  idxEscadaPorStair.push({ stair, base, l0Topo, l1Base, l1Topo, l2Base, topo, patamar, passarelaFim });
}

// --- 6) Grade do pátio (5×5 m: x −30…+30; z −16…+9) ---
// Pulamos pontos dentro dos canteiros (PATIO.canteiros) ou sobre as escadas —
// com `yRef = 0`, `alturaNaRampa` só captura pontos onde a rampa está BAIXA
// (≤ 1,5 m do chão); o solo sob lances/patamares/passarelas elevados (≥ 2,6 m
// de vão livre) é caminhável e mantém seu nó. Exceção: lances com base no
// SOLO (base.y = 0) são maciços até o chão — qualquer ponto da projeção deles
// é corpo sólido (sem vão), então o nó é pulado em qualquer altura.
const COLUNAS_PATIO = [-30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30];
const LINHAS_PATIO = [-16, -11, -6, -1, 4, 9];
function dentroDeCanteiro(x: number, z: number): boolean {
  return PATIO.canteiros.some(
    (c) => Math.abs(x - c.pos[0]) < c.w / 2 + 0.3 && Math.abs(z - c.pos[2]) < c.d / 2 + 0.3,
  );
}
/** Ponto dentro da projeção (com folga) de um lance maciço (base no solo)? */
function dentroDeLanceMacico(x: number, z: number): boolean {
  for (const s of STAIRS) {
    for (const l of s.lances) {
      if (l.base[1] !== 0) continue;
      const minX = Math.min(l.base[0], l.topo[0]) - s.largura / 2 - 0.1;
      const maxX = Math.max(l.base[0], l.topo[0]) + s.largura / 2 + 0.1;
      const minZ = Math.min(l.base[2], l.topo[2]) - 0.1;
      const maxZ = Math.max(l.base[2], l.topo[2]) + 0.1;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
    }
  }
  return false;
}
for (const z of LINHAS_PATIO) {
  for (const x of COLUNAS_PATIO) {
    if (dentroDeCanteiro(x, z)) continue;
    if (dentroDeLanceMacico(x, z)) continue;
    if (STAIRS.some((s) => alturaNaRampa(s, x, z, 0) !== null)) continue;
    addNo({ id: `patio-${x}-${z}`, pos: [x, 0, z], andar: 0, tipo: 'patio' });
  }
}
// Conectores extras do pátio (faixa leste junto à escada A e mastro).
const EXTRAS_PATIO: [number, number, string][] = [
  [30, 0, 'patio-leste-0'],
  [1.5, -4.5, 'patio-mastro'],
];
for (const [x, z, id] of EXTRAS_PATIO) {
  addNo({
    id,
    pos: [x, 0, z],
    andar: 0,
    tipo: 'patio',
    tags: id === 'patio-mastro' ? ['mastro'] : undefined,
  });
}

// --- 7) Contornos leste/oeste (ligam pátio ao quintal sul) ---
// Leste: faixa entre o Bloco B e o alambrado da quadra (x=+31).
for (const z of [5, 10, 15, 20, 25, 30]) {
  addNo({ id: `contorno-leste-${z}`, pos: [31, 0, z], andar: 0, tipo: 'patio' });
}
// Oeste: com o Bloco C novo (x −45…−33), a antiga passagem externa z +10…+20
// virou área interna (parede compartilhada C↔B) — restam os nós ao sul do
// Bloco B, na entrada oeste do quintal.
for (const z of [24, 29]) {
  addNo({ id: `contorno-oeste-${z}`, pos: [-30, 0, z], andar: 0, tipo: 'patio' });
}
// Aproximação da entrada da quadra (alambrado com vão em z −6…−2, x=40).
addNo({ id: 'quadra-aprox-1', pos: [33, 0, 1], andar: 0, tipo: 'quadra' });
addNo({ id: 'quadra-aprox-2', pos: [36, 0, -1.5], andar: 0, tipo: 'quadra' });

// --- 8) Espinha do quintal sul (entre Bloco B e o muro sul) ---
for (let i = 0; i < 12; i++) {
  const x = -31 + (62 / 12) * i; // −31 … ~25,8; o elo final é o contorno-leste-30
  addNo({ id: `quintal-${i}`, pos: [x, 0, 30], andar: 0, tipo: 'patio' });
}

// --- 9) Portão, guarita e rua ---
addNo({ id: 'portao-aprox-1', pos: [-20.7, 0, 35.2], andar: 0, tipo: 'portao' });
addNo({ id: 'portao-aprox-2', pos: [-20.3, 0, 40.5], andar: 0, tipo: 'portao' });
addNo({ id: 'portao-dentro', pos: [-20, 0, 43.4], andar: 0, tipo: 'portao' });
addNo({ id: 'portao-fora', pos: [-20, 0, 46.6], andar: 0, tipo: 'portao' });
addNo({ id: 'guarita-aprox', pos: [-17.5, 0, 42.2], andar: 0, tipo: 'portao' });
addNo({ id: 'guarita-porta-ext', pos: [-14.5, 0, 41.3], andar: 0, tipo: 'porta' });
addNo({
  id: 'guarita-int',
  pos: [-14.5, 0, 43.0],
  andar: 0,
  tipo: 'admin',
  tags: ['guarita'],
});
PORTARIA.spawnRua.forEach((p, i) => {
  addNo({ id: `rua-${i}`, pos: [...p], andar: 0, tipo: 'rua', tags: ['spawn'] });
});

// --- 10) Quadra: portões do alambrado + espinha central (gol a gol) ---
const idxQuadraExt = addNo({ id: 'quadra-portao-ext', pos: [38.7, 0, -4], andar: 0, tipo: 'quadra' });
const idxQuadraInt = addNo({ id: 'quadra-portao-int', pos: [41.3, 0, -4], andar: 0, tipo: 'quadra' });
arestasExplicitas.push([idxQuadraExt, idxQuadraInt]);
[44, 48, 52, 55, 59, 63, 66.5].forEach((x, i) => {
  addNo({
    id: `quadra-centro-${i}`,
    pos: [x, 0, -2.5],
    andar: 0,
    tipo: 'quadra',
    tags: i === 3 ? ['centro-quadra'] : undefined,
  });
});

// --- 11) Fila do refeitório (início da fila) ---
addNo({
  id: 'refeitorio-fila',
  pos: [...REFEITORIO.filaSlots[0]],
  andar: 0,
  tipo: 'refeitorio',
  salaId: 'refeitorio',
  tags: ['fila'],
});

// --- 12) Fila do almoxarifado ---
// 6 posições à frente da mesa, da máquina Fill em direção à porta
// (ALMOXARIFADO.fila); cadeia explícita slot a slot.
let filaAlmoxAnterior = -1;
ALMOXARIFADO.fila.forEach((p, i) => {
  const idx = addNo({
    id: `almoxarifado-fila-${i}`,
    pos: [...p],
    andar: 0,
    tipo: 'admin',
    salaId: 'almoxarifado',
    tags: ['fila'],
  });
  if (filaAlmoxAnterior >= 0) arestasExplicitas.push([filaAlmoxAnterior, idx]);
  filaAlmoxAnterior = idx;
});

// --- 13) Liga as escadas ao restante do grafo ---
// Regra: cada nó de escada que PISA num piso real ganha uma aresta explícita
// para o nó não-escada mais próximo do mesmo andar:
// - base (térreo), saída/pé do 1º andar (varanda/laje) e topo (3º andar): sempre;
// - saída/pé do 2º andar: só na escada INTERNA (C, sem patamar flutuante —
//   `patamares` vazio), pois nas escadas A/B esses nós ficam sobre o patamar
//   flutuante em y=6 e o acesso ao 2º andar é pela PASSARELA (`pass-2`).
function nearestNaoEscada(pos: Vec3, andar: Andar): number {
  let melhor = -1;
  let melhorD = Infinity;
  nos.forEach((n, i) => {
    if (n.tipo === 'escada' || n.andar !== andar) return;
    const d = dist(pos, n.pos);
    if (d < melhorD) {
      melhorD = d;
      melhor = i;
    }
  });
  return melhor;
}
for (const e of idxEscadaPorStair) {
  const interna = e.stair.patamares.length === 0;
  const ligar: number[] = [e.base, e.l0Topo, e.l1Base, e.topo];
  if (interna) ligar.push(e.l1Topo, e.l2Base);
  if (e.passarelaFim >= 0) ligar.push(e.passarelaFim);
  for (const idx of ligar) {
    const alvo = nearestNaoEscada(nos[idx].pos, nos[idx].andar);
    if (alvo >= 0) arestasExplicitas.push([idx, alvo]);
  }
}

// ---------------------------------------------------------------------------
// Construção das arestas
// ---------------------------------------------------------------------------

const DIST_ARESTA = 5.5; // distância máxima EM PLANTA (XZ)
const DY_ARESTA = 1.0; // Δy máximo — arestas automáticas NUNCA ligam pavimentos
const chaves = new Set<string>();
const pares: [number, number][] = [];

function addAresta(a: number, b: number) {
  if (a === b || a < 0 || b < 0) return;
  const k = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (chaves.has(k)) return;
  chaves.add(k);
  pares.push(a < b ? [a, b] : [b, a]);
}

// Automáticas: mesmo andar, Δy ≤ 1 m, ≤ 5,5 m em planta, linha livre;
// nós 'escada' só entram por aresta explícita.
for (let i = 0; i < nos.length; i++) {
  for (let j = i + 1; j < nos.length; j++) {
    const a = nos[i];
    const b = nos[j];
    if (a.andar !== b.andar) continue;
    if (a.tipo === 'escada' || b.tipo === 'escada') continue;
    if (Math.abs(a.pos[1] - b.pos[1]) > DY_ARESTA) continue;
    if (distPlanta(a.pos, b.pos) > DIST_ARESTA) continue;
    if (cruzaParede(a.pos, b.pos, a.andar)) continue;
    addAresta(i, j);
  }
}
// Explícitas (portas de salas, escadas, ligações C↔A/C↔B, portão da quadra).
for (const [a, b] of arestasExplicitas) addAresta(a, b);

/** Lista de nós do grafo (índice = posição neste array). */
export const WAYPOINTS: readonly WaypointNode[] = nos;

/** Arestas como pares de índices de WAYPOINTS (não direcionadas). */
export const EDGES: readonly [number, number][] = pares;

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

const INDICE_POR_ID = new Map(nos.map((n, i) => [n.id, i]));

/** Índice do nó pelo id (ou −1 se não existir). */
export function getNodeIndex(id: string): number {
  return INDICE_POR_ID.get(id) ?? -1;
}

/** Lista de adjacência com pesos (distância euclidiana entre os nós). */
const ADJ: { to: number; w: number }[][] = nos.map(() => []);
for (const [a, b] of pares) {
  const w = dist(nos[a].pos, nos[b].pos);
  ADJ[a].push({ to: b, w });
  ADJ[b].push({ to: a, w });
}

/** Índice do nó mais próximo de `pos` (se `andar` for dado, só nesse andar). */
export function nearestNode(pos: Vec3, andar?: Andar): number {
  let melhor = -1;
  let melhorD = Infinity;
  nos.forEach((n, i) => {
    if (andar !== undefined && n.andar !== andar) return;
    const d = dist(pos, n.pos);
    if (d < melhorD) {
      melhorD = d;
      melhor = i;
    }
  });
  return melhor;
}

/**
 * Menor caminho entre dois nós (A* com heurística euclidiana).
 * Retorna a sequência de índices [fromIdx … toIdx], ou [] se não houver caminho.
 */
export function findPath(fromIdx: number, toIdx: number): number[] {
  const n = nos.length;
  if (fromIdx < 0 || fromIdx >= n || toIdx < 0 || toIdx >= n) return [];
  if (fromIdx === toIdx) return [fromIdx];
  const h = (i: number) => dist(nos[i].pos, nos[toIdx].pos);
  const g = new Float64Array(n).fill(Infinity);
  const f = new Float64Array(n).fill(Infinity);
  const veio = new Int32Array(n).fill(-1);
  const fechado = new Uint8Array(n);
  g[fromIdx] = 0;
  f[fromIdx] = h(fromIdx);
  const aberto: number[] = [fromIdx];
  while (aberto.length > 0) {
    // Extrai o nó de menor f.
    let mi = 0;
    for (let i = 1; i < aberto.length; i++) if (f[aberto[i]] < f[aberto[mi]]) mi = i;
    const atual = aberto.splice(mi, 1)[0];
    if (atual === toIdx) {
      const caminho: number[] = [];
      let c = toIdx;
      while (c !== -1) {
        caminho.push(c);
        c = veio[c];
      }
      return caminho.reverse();
    }
    fechado[atual] = 1;
    for (const { to, w } of ADJ[atual]) {
      if (fechado[to]) continue;
      const tentativa = g[atual] + w;
      if (tentativa < g[to]) {
        veio[to] = atual;
        g[to] = tentativa;
        f[to] = tentativa + h(to);
        if (!aberto.includes(to)) aberto.push(to);
      }
    }
  }
  return [];
}

/** Converte um caminho de índices em posições (para seguir com interpolação). */
export function caminhoParaPosicoes(path: number[]): Vec3[] {
  return path.map((i) => nos[i].pos);
}

// ---------------------------------------------------------------------------
// Validação do grafo
// ---------------------------------------------------------------------------

export interface ResultadoValidacao {
  /** true = todas as salas alcançáveis a partir do portão E grafo totalmente conexo. */
  ok: boolean;
  totalNos: number;
  totalArestas: number;
  alcancaveisDoPortao: number;
  /** Ids das salas cujo nó central NÃO é alcançável a partir do portão. */
  salasInalcancaveis: string[];
  /** Ids de nós (quaisquer) não alcançáveis a partir do portão. */
  nosInalcancaveis: string[];
}

/**
 * Validação estática do grafo: BFS a partir de 'portao-fora' e checagem de
 * que TODOS os nós — em especial o centro de todas as salas — são alcançáveis.
 * Pode ser chamada em runtime (ex.: console de debug) ou por scripts de teste.
 */
export function validateGraph(): ResultadoValidacao {
  const inicio = getNodeIndex('portao-fora');
  const visitado = new Uint8Array(nos.length);
  const fila: number[] = [inicio];
  visitado[inicio] = 1;
  while (fila.length > 0) {
    const atual = fila.pop()!;
    for (const { to } of ADJ[atual]) {
      if (!visitado[to]) {
        visitado[to] = 1;
        fila.push(to);
      }
    }
  }
  const salasInalcancaveis = SALAS.filter((s) => {
    const idx = getNodeIndex(`${s.id}-centro`);
    return idx < 0 || !visitado[idx];
  }).map((s) => s.id);
  const nosInalcancaveis = nos.filter((_, i) => !visitado[i]).map((n) => n.id);
  const alcancaveis = visitado.reduce((acc, v) => acc + v, 0);
  return {
    ok: salasInalcancaveis.length === 0 && nosInalcancaveis.length === 0,
    totalNos: nos.length,
    totalArestas: pares.length,
    alcancaveisDoPortao: alcancaveis,
    salasInalcancaveis,
    nosInalcancaveis,
  };
}
