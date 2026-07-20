/**
 * simulation/pinceis.ts — estado dos pincéis de quadro branco (fora do React).
 *
 * A forma pública desta API é o contrato entre a simulação (W6) e a UI/store
 * (W7), definido em docs/SPEC.md seção "Pincéis" — as assinaturas de
 * `obterResumoPinceis`/`reporEstoque`/`setComAllcanci`/`getComAllcanci`/
 * `resetPinceis` e os tipos `CorPincel`/`ResumoCor`/`ResumoPinceis` NÃO podem
 * mudar. As funções `drenarPincelAtivo`/`precisaRepor`/`contarPinceisBaixos`/
 * `resolverPinceis` e a constante `SEGUNDOS_RECARGA_POR_PINCEL` são a API
 * INTERNA da simulação (usadas por agents.ts/behaviors.ts).
 *
 * Modelo: cada um dos 64 professores (índices 2–65 do ROSTER → slots 0–63)
 * tem 3 pincéis (azul, verde, vermelho) com carga 0–100, numa Float32Array
 * 64×3 (slot*3 + cor; cor 0=azul, 1=verde, 2=vermelho). O professor EM AULA
 * (não o que descansa no rodízio) consome o pincel ativo a ~1,5 %/min-jogo;
 * o pincel ativo rotaciona a cada ~2 min de jogo. Carga < 15 % em qualquer
 * pincel → `precisaRepor`; ao fim do bloco de aula o professor resolve no
 * almoxarifado (ver behaviors.ts):
 * - SEM Allcanci: descarta os pincéis baixos (+1 em `descartados` cada) e
 *   retira novos do estoque; se a cor estiver esgotada, o pincel fica com
 *   carga 0 (e `precisaRepor` continua true — ele tenta de novo depois).
 * - COM Allcanci: recarrega os pincéis baixos na máquina Fill
 *   (~30 s de jogo por pincel, tempo gerido pela tarefa em behaviors.ts);
 *   o estoque não é consumido.
 *
 * Determinístico (sem RNG): taxas fixas e rotação por tempo acumulado.
 * Zero alocação por frame: o resumo só é montado no polling da UI (~500 ms).
 */

export type CorPincel = 'azul' | 'verde' | 'vermelho';

export interface ResumoCor {
  /** Quantidade de pincéis ativos (com os professores) dessa cor. */
  total: number;
  /** Carga média percentual (0–100) dos pincéis ativos dessa cor. */
  cargaMedia: number;
}

export interface ResumoPinceis {
  /** Total de pincéis ativos na escola (professores × 3). */
  totalAtivos: number;
  porCor: Record<CorPincel, ResumoCor>;
  /** Estoque do almoxarifado por cor (pincéis novos, descartáveis). */
  estoque: Record<CorPincel, number>;
  /** Pincéis descartados no dia (modo sem Allcanci). */
  descartados: number;
}

// ---------------------------------------------------------------------------
// Estado interno (pré-alocado)
// ---------------------------------------------------------------------------

/** Número de professores (slots 0–63 ⇔ índices 2–65 do ROSTER). */
const TOTAL_PROFS = 64;
/** Cores por professor (0=azul, 1=verde, 2=vermelho). */
const CORES = 3;
/** Estoque inicial por cor (3 por professor). */
const ESTOQUE_INICIAL = 64;
/** Consumo do pincel ativo (% por minuto de jogo) do professor em aula. */
const DRENO_POR_MIN = 1.5;
/** Rotação do pincel ativo (minutos de jogo) durante a aula. */
const ROTACAO_MIN = 2;
/** Carga abaixo disto (%) dispara a ida ao almoxarifado. */
const LIMITE_REPOR = 15;

/** Tempo de recarga na máquina Fill, em SEGUNDOS de jogo, por pincel baixo. */
export const SEGUNDOS_RECARGA_POR_PINCEL = 30;

/** Cargas 0–100: [slot*3 + cor]. */
const cargas = new Float32Array(TOTAL_PROFS * CORES).fill(100);
/** Índice da cor ativa por professor (0–2); rotaciona durante a aula. */
const pincelAtivo = new Uint8Array(TOTAL_PROFS);
/** Minutos de jogo acumulados desde a última rotação do pincel ativo. */
const tempoRotacao = new Float32Array(TOTAL_PROFS);

const estoque: Record<CorPincel, number> = {
  azul: ESTOQUE_INICIAL,
  verde: ESTOQUE_INICIAL,
  vermelho: ESTOQUE_INICIAL,
};
let descartados = 0;
let comAllcanci = false;

/** Ordem estável cor ↔ índice (0=azul, 1=verde, 2=vermelho). */
const COR_POR_INDICE: readonly CorPincel[] = ['azul', 'verde', 'vermelho'];

// ---------------------------------------------------------------------------
// API interna da simulação (agents.ts / behaviors.ts)
// ---------------------------------------------------------------------------

/**
 * Consome o pincel ativo do professor que está EM AULA e rotaciona o ativo
 * a cada ~2 min de jogo. `dtMinJogo` em MINUTOS de jogo (dtJogo/60 por frame).
 * Chamado só enquanto o professor executa a ação de aula (ver agents.ts) —
 * o colega do rodízio que descansa não drena.
 */
export function drenarPincelAtivo(slot: number, dtMinJogo: number): void {
  tempoRotacao[slot] += dtMinJogo;
  if (tempoRotacao[slot] >= ROTACAO_MIN) {
    tempoRotacao[slot] %= ROTACAO_MIN;
    pincelAtivo[slot] = (pincelAtivo[slot] + 1) % CORES;
  }
  const i = slot * CORES + pincelAtivo[slot];
  if (cargas[i] > 0) {
    cargas[i] = Math.max(0, cargas[i] - DRENO_POR_MIN * dtMinJogo);
  }
}

/** true quando algum dos 3 pincéis do professor está abaixo do limite (15 %). */
export function precisaRepor(slot: number): boolean {
  const base = slot * CORES;
  return (
    cargas[base] < LIMITE_REPOR ||
    cargas[base + 1] < LIMITE_REPOR ||
    cargas[base + 2] < LIMITE_REPOR
  );
}

/** Quantos pincéis do professor estão abaixo do limite (define o tempo da Fill). */
export function contarPinceisBaixos(slot: number): number {
  const base = slot * CORES;
  let n = 0;
  if (cargas[base] < LIMITE_REPOR) n++;
  if (cargas[base + 1] < LIMITE_REPOR) n++;
  if (cargas[base + 2] < LIMITE_REPOR) n++;
  return n;
}

/**
 * Resolve os pincéis baixos no almoxarifado (chamado ao FIM do atendimento,
 * ver behaviors/agents):
 * - com Allcanci: recarrega os baixos a 100 % (máquina Fill; estoque intacto);
 * - sem Allcanci: descarta cada pincel baixo (+1 em `descartados`) e retira
 *   um novo do estoque (carga 100); cor esgotada → o pincel fica com carga 0.
 */
export function resolverPinceis(slot: number): void {
  const base = slot * CORES;
  for (let c = 0; c < CORES; c++) {
    if (cargas[base + c] >= LIMITE_REPOR) continue;
    if (comAllcanci) {
      cargas[base + c] = 100;
    } else {
      descartados++;
      const cor = COR_POR_INDICE[c];
      if (estoque[cor] > 0) {
        estoque[cor]--;
        cargas[base + c] = 100;
      } else {
        cargas[base + c] = 0;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// API pública (contrato com a UI/store — NÃO alterar assinaturas)
// ---------------------------------------------------------------------------

/** Snapshot imutável para a UI (polling ~500 ms — não assinar por frame). */
export function obterResumoPinceis(): ResumoPinceis {
  const porCor = {} as Record<CorPincel, ResumoCor>;
  for (let c = 0; c < CORES; c++) {
    let soma = 0;
    for (let slot = 0; slot < TOTAL_PROFS; slot++) soma += cargas[slot * CORES + c];
    porCor[COR_POR_INDICE[c]] = { total: TOTAL_PROFS, cargaMedia: soma / TOTAL_PROFS };
  }
  return {
    totalAtivos: TOTAL_PROFS * CORES,
    porCor,
    estoque: { azul: estoque.azul, verde: estoque.verde, vermelho: estoque.vermelho },
    descartados,
  };
}

/** Repõe o estoque do almoxarifado para 64 de cada cor (ação manual da UI). */
export function reporEstoque(): void {
  estoque.azul = ESTOQUE_INICIAL;
  estoque.verde = ESTOQUE_INICIAL;
  estoque.vermelho = ESTOQUE_INICIAL;
}

/** Define o modo de operação: false = descartáveis (sem Allcanci). */
export function setComAllcanci(valor: boolean): void {
  comAllcanci = valor;
}

export function getComAllcanci(): boolean {
  return comAllcanci;
}

/** Wrap diário: cargas a 100 %, descartados zeram; estoque NÃO repõe sozinho. */
export function resetPinceis(): void {
  cargas.fill(100);
  pincelAtivo.fill(0);
  tempoRotacao.fill(0);
  descartados = 0;
}
