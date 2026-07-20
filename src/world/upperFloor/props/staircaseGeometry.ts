/**
 * staircaseGeometry.ts — Geometria PURA do acabamento das 3 escadarias
 * (STAIRS), sem nenhum import de React/three: calcula as caixas instanciadas
 * de degraus, bocéis, estrutura (viga-caixão + vigas de borda + escoras),
 * corrimãos e balaústres. Separada do componente (Staircase.tsx) para
 * permitir validação headless — mesmo padrão de upperWalls.ts e do
 * validateGraph de waypoints.ts.
 *
 * ACABAMENTO (revisão visual — a GEOMETRIA do contrato é preservada):
 * - Lance TÉRREO (base y=0): degraus maciços até o chão. Lances ELEVADOS:
 *   viga-caixão contínua (laje inclinada de 0,25 m, rotX acompanhando o
 *   lance) de fundo LISO, sobre a qual cada degrau vira um caixote fino
 *   (espelho + embutido na viga) — fim da laje dente-de-serra.
 * - Nariz de cada degrau com filete/bocel de contraste (caixa ~0,024 m mais
 *   escura) para leitura clara dos espelhos.
 * - Corrimão em DOIS níveis (0,92 m + 0,50 m) nos DOIS lados de cada lance,
 *   com balaústres verticais a cada ~0,4 m.
 * - Patamares/passarelas y=6: laje fina + vigas de borda aparentes
 *   (0,25×0,5 m) sob as bordas livres — puladas onde um lance passa por
 *   baixo, para não invadir o vão de passeio (2,0 m) de quem sobe/desce —
 *   mais escoras inclinadas ancoradas na face da viga-caixão do lance
 *   vizinho. NENHUM apoio novo no chão do pátio (sem obstáculos em WALLS).
 *
 * Premissa do contrato: todos os lances correm ao longo do eixo Z
 * (dir = (0,0,±1)); por isso corrimãos/viga-caixão usam rotação apenas em X
 * (rotX = atan2(dy, dz) cobre dz positivo e negativo). Escoras genéricas
 * usam o par rotX/rotY que alinha o eixo Z local da caixa à direção da peça.
 */

import { STAIRS, type LanceDef, type StairDef } from '../../../contracts/layout';
import type { Vec3 } from '../../../contracts/types';
import type { ItemCaixa } from './InstancedBoxes';

/** Altura do corrimão superior acima da linha de passeio do lance. */
const H_CORRIMAO = 0.92;
/** Altura do corrimão intermediário (2º nível, exigência em escola). */
const H_CORRIMAO_MEDIO = 0.5;
/** Espaçamento alvo dos balaústres verticais. */
const PASSO_BALAUSTRE = 0.4;
/** Espelho alvo dos degraus (~0,17 m, norma escolar). */
const ESPELHO = 0.17;
/** Espessura das lajes de patamar/passarela. */
const ESP_PATAMAR = 0.28;
/** Espessura da viga-caixão (laje inclinada contínua dos lances elevados). */
const ESP_CAIXAO = 0.25;
/** Folga vertical entre a linha de passeio e o topo da viga-caixão. */
const FOLGA_CAIXAO = 0.1;
/** Quanto o caixote do degrau desce abaixo da linha de passeio (embutido na viga-caixão). */
const EMBUT_DEGRAU = 0.14;
/** Revelo lateral da viga-caixão além da largura útil do lance. */
const REVEL_CAIXAO = 0.04;
/** Largura × altura das vigas de borda dos patamares/passarelas. */
const VIGA_LARG = 0.25;
const VIGA_ALT = 0.5;
/** Seção quadrada das escoras inclinadas. */
const SEC_ESCORA = 0.18;
/** Vão livre protegido sobre a linha de passeio (vigas/escoras não invadem). */
const VAO_PASSEIO = 2.0;

// ---------------------------------------------------------------------------
// Auxiliares geométricos (tudo derivado de StairDef — sem hardcode de cotas)
// ---------------------------------------------------------------------------

/** Retângulo em planta da projeção da viga-caixão de um lance. */
interface FaixaPlanta {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Projeção em planta da viga-caixão do lance (premissa: lances ao longo de Z). */
function faixaDoLance(lance: LanceDef, largura: number): FaixaPlanta {
  const meiaLarg = largura / 2 + REVEL_CAIXAO;
  const cx = (lance.base[0] + lance.topo[0]) / 2;
  return {
    minX: cx - meiaLarg,
    maxX: cx + meiaLarg,
    minZ: Math.min(lance.base[2], lance.topo[2]),
    maxZ: Math.max(lance.base[2], lance.topo[2]),
  };
}

/** Cota y da linha de passeio do lance na vertical de (x, z) (projeção clampada). */
function nivelLance(lance: LanceDef, x: number, z: number): number {
  const dx = lance.topo[0] - lance.base[0];
  const dy = lance.topo[1] - lance.base[1];
  const dz = lance.topo[2] - lance.base[2];
  const run2 = dx * dx + dz * dz;
  const t =
    run2 === 0
      ? 0
      : Math.min(1, Math.max(0, ((x - lance.base[0]) * dx + (z - lance.base[2]) * dz) / run2));
  return lance.base[1] + dy * t;
}

/**
 * true se a faixa vertical [y0, y1] em (x, z) toca o vão de passeio de algum
 * lance da escada (de `nivel − folgaBaixo` até `nivel + folgaCima`; folga
 * negativa encolhe a faixa). Usado para NÃO pendurar viga de borda nem
 * escora na cara de quem está subindo/descendo um lance que passa por baixo
 * (ex.: lance 2 da escada B sob o patamar) ou por cima.
 */
function tocaVaoPasseio(
  stair: StairDef,
  faixas: FaixaPlanta[],
  x: number,
  z: number,
  y0: number,
  y1: number,
  folgaBaixo: number,
  folgaCima: number,
): boolean {
  for (let i = 0; i < stair.lances.length; i++) {
    const f = faixas[i];
    if (x < f.minX - 0.05 || x > f.maxX + 0.05 || z < f.minZ - 0.05 || z > f.maxZ + 0.05) continue;
    const w = nivelLance(stair.lances[i], x, z);
    if (y1 > w - folgaBaixo && y0 < w + folgaCima) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cálculo por escada (degraus, bocéis, estrutura, corrimãos, balaústres)
// ---------------------------------------------------------------------------

export interface DadosEscada {
  /** Degraus (maciços no térreo, caixotes finos nos elevados) + lajes de patamar. */
  degraus: ItemCaixa[];
  /** Filetes/bocéis escuros no nariz dos degraus. */
  bocais: ItemCaixa[];
  /** Viga-caixão + vigas de borda + escoras (concreto pintado, cor de coluna). */
  estrutura: ItemCaixa[];
  corrimaos: ItemCaixa[];
  balaustres: ItemCaixa[];
}

/** Lances: degraus + bocel, viga-caixão (elevados), corrimãos e balaústres. */
function calcularLance(stair: StairDef, lance: LanceDef, d: DadosEscada): void {
  const a = lance.base;
  const b = lance.topo;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const run = Math.hypot(dx, dz);
  const dirX = dx / run;
  const dirZ = dz / run;
  // Lateral horizontal (perpendicular à subida): para dir ±Z resulta em ±X.
  const latX = -dirZ;
  const latZ = dirX;
  const rotX = Math.atan2(dy, dz); // inclinação do lance (lances ao longo de Z)
  const comp = Math.hypot(run, dy);
  const noSolo = a[1] < 0.01;
  const meiaLarg = stair.largura / 2;

  // --- Degraus + filete/bocel no nariz.
  const n = Math.max(1, Math.round(dy / ESPELHO));
  const espelho = dy / n;
  const piso = run / n;
  const sizeX = stair.largura * Math.abs(latX) + (piso + 0.02) * Math.abs(dirX);
  const sizeZ = stair.largura * Math.abs(latZ) + (piso + 0.02) * Math.abs(dirZ);
  const bocelX = stair.largura * Math.abs(latX) + 0.06 * Math.abs(dirX);
  const bocelZ = stair.largura * Math.abs(latZ) + 0.06 * Math.abs(dirZ);
  for (let i = 0; i < n; i++) {
    const yTopo = a[1] + (i + 1) * espelho;
    // Térreo: maciço até o chão; elevado: caixote fino embutido na viga-caixão.
    const yFundo = noSolo ? 0 : yTopo - espelho - EMBUT_DEGRAU;
    d.degraus.push({
      pos: [a[0] + dirX * (i + 0.5) * piso, (yTopo + yFundo) / 2, a[2] + dirZ * (i + 0.5) * piso],
      size: [sizeX, yTopo - yFundo, sizeZ],
    });
    // Bocel: caixa fina escura na borda de jusante do degrau (leitura do espelho).
    d.bocais.push({
      pos: [a[0] + dirX * (i * piso - 0.005), yTopo + 0.004, a[2] + dirZ * (i * piso - 0.005)],
      size: [bocelX, 0.024, bocelZ],
    });
  }

  // --- Viga-caixão contínua sob os degraus (só lances elevados): fundo liso.
  // O topo da viga fica FOLGA_CAIXAO abaixo da linha de passeio; como a caixa
  // é rotacionada, a distância VERTICAL centro→face é (ESP/2)·(comp/run).
  if (!noSolo) {
    d.estrutura.push({
      pos: [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2 - FOLGA_CAIXAO - (ESP_CAIXAO / 2) * (comp / run),
        (a[2] + b[2]) / 2,
      ],
      size: [stair.largura + 2 * REVEL_CAIXAO, ESP_CAIXAO, comp + 0.24],
      rot: [rotX, 0, 0],
    });
  }

  // --- Corrimãos em 2 níveis + balaústres a cada ~0,4 m, nos dois lados.
  const midX = (a[0] + b[0]) / 2;
  const midY = (a[1] + b[1]) / 2;
  const midZ = (a[2] + b[2]) / 2;
  for (const s of [-1, 1]) {
    const ox = latX * s * (meiaLarg - 0.07);
    const oz = latZ * s * (meiaLarg - 0.07);
    for (const h of [H_CORRIMAO, H_CORRIMAO_MEDIO]) {
      d.corrimaos.push({
        pos: [midX + ox, midY + h, midZ + oz],
        size: [0.07, 0.07, comp],
        rot: [rotX, 0, 0],
      });
    }
    const nb = Math.max(1, Math.round(run / PASSO_BALAUSTRE));
    for (let k = 0; k <= nb; k++) {
      const t = k / nb;
      d.balaustres.push({
        pos: [a[0] + dx * t + ox, a[1] + dy * t + H_CORRIMAO / 2, a[2] + dz * t + oz],
        size: [0.05, H_CORRIMAO, 0.05],
      });
    }
  }
}

/** Uma borda de laje de patamar: linha `fixo`, vão `de…ate`, orientação. */
interface Borda {
  /** true = viga ao longo de X (borda norte/sul); false = ao longo de Z. */
  aoLongoX: boolean;
  fixo: number;
  de: number;
  ate: number;
}

/** Patamares/passarelas: laje fina + vigas de borda + escoras inclinadas. */
function calcularPatamares(stair: StairDef, faixas: FaixaPlanta[], d: DadosEscada): void {
  const emitidas: Borda[] = []; // vigas já lançadas (dedup das junções)
  for (const p of stair.patamares) {
    const r = p.rect;
    // Laje fina do patamar/passarela (face superior na cota do contrato).
    d.degraus.push({
      pos: [r.x + r.w / 2, p.y - ESP_PATAMAR / 2, r.z + r.d / 2],
      size: [r.w, ESP_PATAMAR, r.d],
    });
    // 0,005 de folga sob a laje evita z-fighting entre faces coplanares.
    const yViga = p.y - ESP_PATAMAR - VIGA_ALT / 2 - 0.005;
    const yVigaBaixo = p.y - ESP_PATAMAR - VIGA_ALT - 0.005;
    const yVigaTopo = p.y - ESP_PATAMAR - 0.005;

    // --- Vigas de borda (0,25×0,5) nas bordas livres da laje.
    const bordas: Borda[] = [
      { aoLongoX: true, fixo: r.z, de: r.x, ate: r.x + r.w },
      { aoLongoX: true, fixo: r.z + r.d, de: r.x, ate: r.x + r.w },
      { aoLongoX: false, fixo: r.x, de: r.z, ate: r.z + r.d },
      { aoLongoX: false, fixo: r.x + r.w, de: r.z, ate: r.z + r.d },
    ];
    for (const b of bordas) {
      // Junção com laje vizinha no mesmo nível: uma única viga por linha.
      const dupla = emitidas.some(
        (e) =>
          e.aoLongoX === b.aoLongoX &&
          Math.abs(e.fixo - b.fixo) < 0.02 &&
          Math.min(e.ate, b.ate) - Math.max(e.de, b.de) > 0.5 * (b.ate - b.de),
      );
      if (dupla) continue;
      // Não pendurar viga no vão de passeio de um lance que passa por baixo.
      const pontos: [number, number][] = b.aoLongoX
        ? [
            [b.de, b.fixo],
            [(b.de + b.ate) / 2, b.fixo],
            [b.ate, b.fixo],
          ]
        : [
            [b.fixo, b.de],
            [b.fixo, (b.de + b.ate) / 2],
            [b.fixo, b.ate],
          ];
      if (
        pontos.some(([px, pz]) =>
          tocaVaoPasseio(stair, faixas, px, pz, yVigaBaixo, yVigaTopo, 0.02, VAO_PASSEIO),
        )
      ) {
        continue;
      }
      emitidas.push(b);
      const meio = (b.de + b.ate) / 2;
      const compBorda = b.ate - b.de + VIGA_LARG; // fecha os cantos do quadro
      d.estrutura.push(
        b.aoLongoX
          ? { pos: [meio, yViga, b.fixo], size: [compBorda, VIGA_ALT, VIGA_LARG] }
          : { pos: [b.fixo, yViga, meio], size: [VIGA_LARG, VIGA_ALT, compBorda] },
      );
    }

    // --- Escoras inclinadas: da viga de borda até a face da viga-caixão do
    //     lance vizinho (estrutura ancorada na própria escada — sem pilares
    //     no chão do pátio). Só faz sentido para lance ADJACENTE em planta
    //     (vão ≤ 2,6 m) e com desnível útil (0,5…2,6 m).
    stair.lances.forEach((lance, li) => {
      const f = faixas[li];
      const gapX = Math.max(f.minX - (r.x + r.w), r.x - f.maxX, 0);
      const gapZ = Math.max(f.minZ - (r.z + r.d), r.z - f.maxZ, 0);
      const gap = Math.hypot(gapX, gapZ);
      // Sobreposto/encostado (a estrutura é o próprio lance) ou distante: nada.
      if (gap < 0.05 || gap > 2.6) return;
      const aoLongoZ = gapX >= gapZ; // borda voltada ao lance é vertical (fixo = x)
      const fora = aoLongoZ
        ? f.minX >= r.x + r.w - 0.01
          ? 1
          : -1
        : f.minZ >= r.z + r.d - 0.01
          ? 1
          : -1;
      const fixo = aoLongoZ ? (fora > 0 ? r.x + r.w : r.x) : fora > 0 ? r.z + r.d : r.z;
      const sDe = (aoLongoZ ? Math.max(r.z, f.minZ) : Math.max(r.x, f.minX)) + 0.5;
      const sAte = (aoLongoZ ? Math.min(r.z + r.d, f.maxZ) : Math.min(r.x + r.w, f.maxX)) - 0.5;
      if (sAte <= sDe) return;
      for (let s = sDe; s <= sAte + 1e-6; s += 2.2) {
        const pR: Vec3 = aoLongoZ
          ? [fixo + fora * (VIGA_LARG / 2), yViga, s]
          : [s, yViga, fixo + fora * (VIGA_LARG / 2)];
        const faceL = aoLongoZ ? (fora > 0 ? f.minX : f.maxX) : fora > 0 ? f.minZ : f.maxZ;
        const pL: Vec3 = aoLongoZ
          ? [faceL, nivelLance(lance, faceL, s) - 0.22, s]
          : [s, nivelLance(lance, s, faceL) - 0.22, faceL];
        const vx = pL[0] - pR[0];
        const vy = pL[1] - pR[1];
        const vz = pL[2] - pR[2];
        const h = Math.hypot(vx, vz);
        if (h < 0.6 || h > 2.8 || Math.abs(vy) < 0.5 || Math.abs(vy) > 2.6) continue;
        // A escora não pode atravessar o vão de passeio de nenhum lance.
        let livre = true;
        for (let k = 1; k < 5 && livre; k++) {
          const t = k / 5;
          const px = pR[0] + vx * t;
          const py = pR[1] + vy * t;
          const pz = pR[2] + vz * t;
          if (
            tocaVaoPasseio(
              stair,
              faixas,
              px,
              pz,
              py - SEC_ESCORA / 2,
              py + SEC_ESCORA / 2,
              -0.02,
              VAO_PASSEIO + 0.05,
            )
          ) {
            livre = false;
          }
        }
        if (!livre) continue;
        // Caixa alinhada à direção da escora (eixo Z local → vetor unitário).
        const compS = Math.hypot(h, vy);
        const dl = 1 / compS;
        d.estrutura.push({
          pos: [(pR[0] + pL[0]) / 2, (pR[1] + pL[1]) / 2, (pR[2] + pL[2]) / 2],
          size: [SEC_ESCORA, SEC_ESCORA, compS + 0.15],
          rot: [
            Math.atan2(-vy * dl, vz * dl),
            Math.atan2(vx * dl, Math.hypot(vy * dl, vz * dl)),
            0,
          ],
        });
      }
    });
  }
}

/** Caixas de acabamento de UMA escadaria (função pura — testável headless). */
export function calcularEscada(stair: StairDef): DadosEscada {
  const d: DadosEscada = { degraus: [], bocais: [], estrutura: [], corrimaos: [], balaustres: [] };
  const faixas = stair.lances.map((l) => faixaDoLance(l, stair.largura));
  for (const lance of stair.lances) calcularLance(stair, lance, d);
  calcularPatamares(stair, faixas, d);
  return d;
}

/** Caixas de acabamento das 3 escadarias do contrato, agrupadas por tipo. */
export function calcularEscadarias(): DadosEscada {
  const dados = STAIRS.map(calcularEscada);
  const juntar = (campo: keyof DadosEscada): ItemCaixa[] => dados.flatMap((d) => d[campo]);
  return {
    degraus: juntar('degraus'),
    bocais: juntar('bocais'),
    estrutura: juntar('estrutura'),
    corrimaos: juntar('corrimaos'),
    balaustres: juntar('balaustres'),
  };
}
