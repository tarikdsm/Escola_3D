/**
 * rig.ts — CORPO PARAMÉTRICO dos 712 personagens (pré-computado UMA vez no
 * mount; NADA é alocado por frame — o useFrame só lê estes arrays).
 *
 * Cada personagem recebe, de forma DETERMINÍSTICA por índice (RNG mulberry32
 * semeado pelo próprio índice — editar o roster não muda quem já existia):
 * - fator de altura: adultos 1,55–1,85 m; alunos 1,20–1,55 m;
 * - biotipo: magro (×0,90) / médio (×1,00) / largo (×1,12) nas larguras;
 * - sexo (vem do roster): ajusta ombros/quadril e define saia/detalhePeitoF;
 * - estilo de cabelo (0–6, ou CARECA) e cor de sapato;
 * - avental: só o almoxarife (papel 'almoxarife', índice 711 — adulto sem
 *   mochila, como todo não-aluno).
 *
 * Proporções: adulto ≈ 7,5 cabeças (cabeça = altura/7,5 ≈ 0,23 m). O tronco
 * é dividido em quadril (pelve) + peito; cada membro tem 2 segmentos com
 * comprimentos anatômicos derivados da altura total:
 *   pé 0,055·H · canela 0,24·H · coxa 0,25·H · pelve 0,09·H
 *   peito = resto ≈ 0,20·H · pescoço 0,035·H · cabeça 0,133·H
 *   braço sup. 0,17·H · antebraço 0,155·H · mão 0,09·H
 * SIM.pos.y é o PISO sob os pés: o rig monta do tornozelo para cima
 * (quadril em pé = pé + canela + coxa ≈ 0,545·H; sentado = 0,45 m, altura
 * fixa do assento das carteiras — ver Characters.tsx).
 */

import { ROSTER } from '../contracts';

/** Nº de estilos de cabelo renderizados (uma InstancedMesh por estilo). */
export const N_ESTILOS_CABELO = 7;
/** Valor de `cabelo[]` para careca (todas as malhas de cabelo com escala 0). */
export const CARECA = 7;
/** Nomes dos estilos na ordem das malhas (0–6) — só para documentação/debug. */
export const ESTILOS_CABELO = [
  'curto',
  'raspado',
  'afro',
  'raboCavalo',
  'longo',
  'coque',
  'trancas',
] as const;

/** Tons escuros de sapato (pré-escola a adulto), sorteados por índice. */
export const SAPATOS = ['#2b2620', '#3a2e26', '#424242', '#4e342e', '#263238', '#5d4037'];

/** Altura fixa do assento das carteiras (quadril sentado), como antes. */
export const ALTURA_ASSENTO = 0.45;

/** RNG determinístico (mulberry32) — semente por índice do personagem. */
function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Dados corporais de todos os personagens, indexados por `PersonagemInfo.indice`.
 * Somente Float32Array/Uint8Array planos — zero objetos por personagem.
 */
export interface RigPersonagens {
  /** Altura total (m): 1,20–1,55 alunos · 1,55–1,85 adultos. */
  altura: Float32Array;
  /** Altura do quadril EM PÉ (tornozelo + canela + coxa). */
  quadrilPe: Float32Array;
  /** Alturas dos segmentos do tronco/cabeça (m). */
  quadrilSeg: Float32Array;
  peitoSeg: Float32Array;
  pescoco: Float32Array;
  cabecaH: Float32Array;
  /** Comprimentos dos segmentos das pernas (m). */
  coxa: Float32Array;
  canela: Float32Array;
  peAltura: Float32Array;
  peComp: Float32Array;
  /** Comprimentos dos segmentos dos braços (m). */
  bracoSup: Float32Array;
  antebraco: Float32Array;
  mao: Float32Array;
  /** Larguras/espessuras (m) — já incluem biotipo e ajuste de sexo. */
  ombros: Float32Array;
  peitoW: Float32Array;
  peitoD: Float32Array;
  quadrilW: Float32Array;
  quadrilD: Float32Array;
  bracoEsp: Float32Array;
  pernaEsp: Float32Array;
  pescocoEsp: Float32Array;
  /** Atributos discretos. */
  cabelo: Uint8Array; // 0–6 = estilo · CARECA = 7
  saia: Uint8Array; // 1 = usa saia (parte das personagens F)
  detalheF: Uint8Array; // 1 = detalhePeitoF (mulheres adultas)
  mochila: Uint8Array; // 1 = aluno
  avental: Uint8Array; // 1 = almoxarife (avental de trabalho, cor da camisa)
  sapato: Uint8Array; // índice em SAPATOS
}

/**
 * Constrói o rig de todos os personagens. Chamar UMA vez (useMemo no mount).
 */
export function construirRig(): RigPersonagens {
  const n = ROSTER.length;
  const rig: RigPersonagens = {
    altura: new Float32Array(n),
    quadrilPe: new Float32Array(n),
    quadrilSeg: new Float32Array(n),
    peitoSeg: new Float32Array(n),
    pescoco: new Float32Array(n),
    cabecaH: new Float32Array(n),
    coxa: new Float32Array(n),
    canela: new Float32Array(n),
    peAltura: new Float32Array(n),
    peComp: new Float32Array(n),
    bracoSup: new Float32Array(n),
    antebraco: new Float32Array(n),
    mao: new Float32Array(n),
    ombros: new Float32Array(n),
    peitoW: new Float32Array(n),
    peitoD: new Float32Array(n),
    quadrilW: new Float32Array(n),
    quadrilD: new Float32Array(n),
    bracoEsp: new Float32Array(n),
    pernaEsp: new Float32Array(n),
    pescocoEsp: new Float32Array(n),
    cabelo: new Uint8Array(n),
    saia: new Uint8Array(n),
    detalheF: new Uint8Array(n),
    mochila: new Uint8Array(n),
    avental: new Uint8Array(n),
    sapato: new Uint8Array(n),
  };

  for (let i = 0; i < n; i++) {
    const p = ROSTER[i];
    const aluno = p.papel === 'ALUNO';
    const fem = p.sexo === 'F';
    const rand = mulberry32((i + 1) * 0x9e3779b9);

    // --- Altura e biotipo ---
    const h = aluno ? 1.2 + rand() * 0.35 : 1.55 + rand() * 0.3;
    const uBio = rand();
    const larg = uBio < 0.3 ? 0.9 : uBio < 0.78 ? 1.0 : 1.12;

    // --- Comprimentos (frações anatômicas de H) ---
    rig.altura[i] = h;
    rig.cabecaH[i] = h / 7.5;
    rig.pescoco[i] = h * 0.035;
    rig.peAltura[i] = h * 0.055;
    rig.canela[i] = h * 0.24;
    rig.coxa[i] = h * 0.25;
    rig.quadrilSeg[i] = h * 0.09;
    rig.quadrilPe[i] = rig.peAltura[i] + rig.canela[i] + rig.coxa[i];
    // Peito = o que sobra entre o topo da pelve e a base do pescoço.
    rig.peitoSeg[i] =
      h -
      rig.quadrilPe[i] -
      rig.quadrilSeg[i] -
      rig.pescoco[i] -
      rig.cabecaH[i];
    rig.bracoSup[i] = h * 0.17;
    rig.antebraco[i] = h * 0.155;
    rig.mao[i] = h * 0.09;
    rig.peComp[i] = h * 0.14;

    // --- Larguras (biotipo + ajuste de sexo: F ombros −6%, quadril +10%) ---
    const ombroSexo = fem ? 0.94 : 1;
    const quadrilSexo = fem ? 1.1 : 1;
    rig.ombros[i] = h * 0.235 * larg * ombroSexo;
    rig.peitoW[i] = rig.ombros[i] * 0.9;
    rig.peitoD[i] = h * 0.14 * larg;
    rig.quadrilW[i] = h * 0.155 * larg * quadrilSexo;
    rig.quadrilD[i] = rig.peitoD[i] * 0.9;
    rig.bracoEsp[i] = h * 0.042 * larg;
    rig.pernaEsp[i] = h * 0.055 * larg;
    rig.pescocoEsp[i] = rig.cabecaH[i] * 0.42;

    // --- Cabelo (sexo + RNG) ---
    const uCab = rand();
    if (fem) {
      // F: longo 28% · raboCavalo 22% · coque 13% · tranças 15% · curto 12% · afro 10%
      rig.cabelo[i] =
        uCab < 0.28 ? 4 : uCab < 0.5 ? 3 : uCab < 0.63 ? 5 : uCab < 0.78 ? 6 : uCab < 0.9 ? 0 : 2;
    } else {
      // M: curto 55% · raspado 27% · afro 18%; homem adulto tem 8% de careca.
      const careca = !aluno && rand() < 0.08;
      rig.cabelo[i] = careca ? CARECA : uCab < 0.55 ? 0 : uCab < 0.82 ? 1 : 2;
    }

    // --- Saia, detalhePeitoF, mochila, avental, sapato ---
    // Saia: só F — metade das alunas, ~1/3 das mulheres adultas (determinístico).
    rig.saia[i] = fem && rand() < (aluno ? 0.5 : 0.35) ? 1 : 0;
    // Detalhe de peito: só mulheres ADULTAS (alunas não — decisão de bom gosto).
    rig.detalheF[i] = fem && !aluno ? 1 : 0;
    rig.mochila[i] = aluno ? 1 : 0;
    // Avental: só o almoxarife (papel 'almoxarife' — adulto sem mochila).
    rig.avental[i] = p.papel === 'almoxarife' ? 1 : 0;
    rig.sapato[i] = Math.floor(rand() * SAPATOS.length) % SAPATOS.length;
  }

  return rig;
}
