/**
 * waypoints.ts — GRAFO DE NAVEGAÇÃO da escola (fonte única para a IA de NPCs
 * e para o jogador). Gerado PROGRAMATICAMENTE a partir de layout.ts:
 *
 * - Para cada sala: nó central + nó de porta "int" (dentro) e "ext" (fora),
 *   com arestas explícitas centro↔int↔ext.
 * - Espinha dos corredores/varandas (CORREDOR_SPINES): nós a cada ~4 m.
 * - Escadas: nós base/patamar/topo + arestas explícitas base↔patamar↔topo
 *   (é assim que o grafo liga os andares) + ligação da base/topo ao pátio/varanda.
 * - Nós manuais: grade do pátio (5×5 m), contornos leste/oeste do Bloco B,
 *   espinha do quintal sul, portão/guarita/rua, quadra, fila do refeitório.
 *
 * ARESTAS: (1) automáticas — pares de nós no MESMO ANDAR a ≤ 5,5 m cuja linha
 * reta NÃO cruza nenhum AABB de WALLS na altura do torso (andar·3 + 1,0 m);
 * nós do tipo 'escada' ficam fora do automático; (2) explícitas — portas de
 * salas, escadas e ligações de escada.
 *
 * Custam ~250–260 nós; a construção ocorre uma vez na carga do módulo.
 */

import type { Andar, Vec3 } from './types';
import { CONST, CORREDOR_SPINES, PORTARIA, REFEITORIO, SALAS, STAIRS, WALLS, alturaNaRampa, type StairDef } from './layout';

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

// --- 2) Saídas do corredor térreo do Bloco A para o pátio (z=−20) ---
for (const [i, x] of [-16.5, 0, 16.5].entries()) {
  addNo({
    id: `saida-corredor-a-${i}`,
    pos: [x, 0, -19.2],
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

// --- 4) Escadas: base (0,6 m antes da rampa), patamar, topo (0,4 m adiante) ---
const idxEscadaPorStair: { stair: StairDef; base: number; patamar: number; topo: number }[] = [];
for (const stair of STAIRS) {
  const base = addNo({
    id: `${stair.id}-base`,
    pos: [
      stair.base[0] - stair.dir[0] * 0.6,
      stair.base[1],
      stair.base[2] - stair.dir[2] * 0.6,
    ],
    andar: 0,
    tipo: 'escada',
  });
  const patamar = addNo({
    id: `${stair.id}-patamar`,
    pos: [...stair.patamar],
    andar: 0,
    tipo: 'escada',
  });
  const topo = addNo({
    id: `${stair.id}-topo`,
    pos: [
      stair.topo[0] + stair.dir[0] * 0.4,
      stair.topo[1],
      stair.topo[2] + stair.dir[2] * 0.4,
    ],
    andar: 1,
    tipo: 'escada',
  });
  arestasExplicitas.push([base, patamar], [patamar, topo]);
  idxEscadaPorStair.push({ stair, base, patamar, topo });
}

// --- 5) Grade do pátio (colunas a cada 5 m: x −25…+25; linhas z −16…+9) ---
// Pulamos pontos dentro da projeção das escadas ou dos canteiros.
const COLUNAS_PATIO = [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25];
const LINHAS_PATIO = [-16, -11, -6, -1, 4, 9];
const CANTEIROS = [
  { x: -28, z: -17, w: 6, d: 2.5 },
  { x: 28, z: -17, w: 6, d: 2.5 },
  { x: -28, z: 6, w: 6, d: 2.5 },
  { x: 28, z: 6, w: 6, d: 2.5 },
];
function dentroDeCanteiro(x: number, z: number): boolean {
  return CANTEIROS.some(
    (c) => Math.abs(x - c.x) < c.w / 2 + 0.3 && Math.abs(z - c.z) < c.d / 2 + 0.3,
  );
}
for (const z of LINHAS_PATIO) {
  for (const x of COLUNAS_PATIO) {
    if (dentroDeCanteiro(x, z)) continue;
    if (STAIRS.some((s) => alturaNaRampa(s, x, z) !== null)) continue;
    addNo({ id: `patio-${x}-${z}`, pos: [x, 0, z], andar: 0, tipo: 'patio' });
  }
}
// Conectores extras do pátio (faixas leste/oeste ao lado do Bloco B e mastro).
const EXTRAS_PATIO: [number, number, string][] = [
  [30, 0, 'patio-leste-0'],
  [30, 4, 'patio-leste-4'],
  [30, 9, 'patio-leste-9'],
  [-30, 4, 'patio-oeste-4'],
  [-30, 9, 'patio-oeste-9'],
  [-27.5, 11, 'patio-oeste-11'],
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

// --- 6) Contornos leste/oeste do Bloco B (ligam pátio ao quintal sul) ---
for (const z of [5, 10, 15, 20, 25, 30]) {
  addNo({ id: `contorno-leste-${z}`, pos: [31, 0, z], andar: 0, tipo: 'patio' });
}
for (const z of [14, 19, 24, 29]) {
  addNo({ id: `contorno-oeste-${z}`, pos: [-30, 0, z], andar: 0, tipo: 'patio' });
}
// Aproximação da entrada da quadra (alambrado com vão em z −6…−2, x=40).
addNo({ id: 'quadra-aprox-1', pos: [33, 0, 1], andar: 0, tipo: 'quadra' });
addNo({ id: 'quadra-aprox-2', pos: [36, 0, -1.5], andar: 0, tipo: 'quadra' });

// --- 7) Espinha do quintal sul (entre Bloco B e o muro sul) ---
for (let i = 0; i < 12; i++) {
  const x = -31 + (62 / 12) * i; // −31 … ~25,8; o elo final é o contorno-leste-30
  addNo({ id: `quintal-${i}`, pos: [x, 0, 30], andar: 0, tipo: 'patio' });
}

// --- 8) Portão, guarita e rua ---
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

// --- 9) Quadra: portões do alambrado + espinha central (gol a gol) ---
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

// --- 10) Fila do refeitório (início da fila) ---
addNo({
  id: 'refeitorio-fila',
  pos: [...REFEITORIO.filaSlots[0]],
  andar: 0,
  tipo: 'refeitorio',
  salaId: 'refeitorio',
  tags: ['fila'],
});

// --- 11) Liga as escadas ao restante do grafo (base→pátio, topo→varanda) ---
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
for (const { base, topo } of idxEscadaPorStair) {
  arestasExplicitas.push(
    [base, nearestNaoEscada(nos[base].pos, 0)],
    [topo, nearestNaoEscada(nos[topo].pos, 1)],
  );
}

// ---------------------------------------------------------------------------
// Construção das arestas
// ---------------------------------------------------------------------------

const DIST_ARESTA = 5.5;
const chaves = new Set<string>();
const pares: [number, number][] = [];

function addAresta(a: number, b: number) {
  if (a === b || a < 0 || b < 0) return;
  const k = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (chaves.has(k)) return;
  chaves.add(k);
  pares.push(a < b ? [a, b] : [b, a]);
}

// Automáticas: mesmo andar, ≤ 5,5 m, linha livre; nós 'escada' só por explícita.
for (let i = 0; i < nos.length; i++) {
  for (let j = i + 1; j < nos.length; j++) {
    const a = nos[i];
    const b = nos[j];
    if (a.andar !== b.andar) continue;
    if (a.tipo === 'escada' || b.tipo === 'escada') continue;
    if (dist(a.pos, b.pos) > DIST_ARESTA) continue;
    if (cruzaParede(a.pos, b.pos, a.andar)) continue;
    addAresta(i, j);
  }
}
// Explícitas (portas de salas, escadas, portão da quadra).
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
