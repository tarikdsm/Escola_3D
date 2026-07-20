/**
 * Characters.tsx — RENDER INSTANCIADO dos 712 personagens da escola.
 *
 * Uma THREE.InstancedMesh POR PARTE DO CORPO (712 instâncias cada, na ordem
 * do ROSTER → instanceId continua mapeando o personagem no picking):
 *   cabeça · pescoço · peito · quadril · detalhePeitoF · saia
 *   2× (braço superior · antebraço · mão)
 *   2× (coxa · canela · pé)
 *   7 estilos de cabelo (careca = todas com escala 0) · mochila · avental
 * = 27 draw calls de personagem + 2 malhas pequenas (cabo/cerdas da
 * vassoura dos faxineiros, índices derivados do ROSTER). Total ≈ 29
 * instanced draws.
 *
 * A cada frame (useFrame) as posições/animações são lidas DIRETO dos buffers
 * SIM (contracts/simBuffer) — nada de React state por frame. As poses-alvo
 * vêm de animations.ts (computePose, ângulos das JUNTAS) e são suavizadas
 * por personagem (suavizarPose, fator ~10·delta). As matrizes são compostas
 * por cinemática direta (quadril→joelho→tornozelo, ombro→cotovelo→punho,
 * pescoço→cabeça→cabelo) multiplicando Matrix4 pré-alocados — ZERO alocação
 * por frame. As proporções de cada personagem (altura, biotipo, sexo,
 * cabelo) vêm do rig pré-computado em rig.ts (construirRig, 1× no mount).
 *
 * SIM.pos.y é o PISO sob os pés: o corpo é montado do tornozelo para cima.
 * Sentado: o quadril desce para ALTURA_ASSENTO (0,45 m — assento da carteira).
 *
 * Partes que não se aplicam a um personagem (cabelo de outro estilo, saia,
 * detalhePeitoF, mochila de não-aluno, avental de não-almoxarife) ficam com
 * a matriz ZERO do mount — o loop nem as toca. No picking só entram as
 * partes presentes nos 712 (matrizes nunca singulares) — ver
 * PARTES_CLICAVEIS.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ANIM_STATES, PALETTE, ROSTER, SIM } from '../contracts';
import { computePose, criarPoseNeutra, suavizarPose, type Pose } from './animations';
import { ALTURA_ASSENTO, SAPATOS, construirRig, type RigPersonagens } from './rig';
import { registrarMalhaPersonagem } from './picking';

const N = ROSTER.length; // 712
const TAU = Math.PI * 2;

/**
 * Faixa dos faxineiros no ROSTER (donos das vassouras) — DERIVADA do elenco,
 * sem literal de índice: hoje são os índices 708–709.
 */
const IDX_FAXINEIRO_0 = ROSTER.findIndex((p) => p.papel === 'FAXINEIRO');
const N_VASSOURAS = ROSTER.reduce(
  (acc, p) => acc + (p.papel === 'FAXINEIRO' ? 1 : 0),
  0,
);

/** As 27 partes instanciadas com 712 instâncias cada (ordem do ROSTER). */
const PARTES = [
  'cabeca',
  'pescoco',
  'peito',
  'quadril',
  'detalhePeitoF',
  'saia',
  'bracoSupEsq',
  'bracoSupDir',
  'antebracoEsq',
  'antebracoDir',
  'maoEsq',
  'maoDir',
  'coxaEsq',
  'coxaDir',
  'canelaEsq',
  'canelaDir',
  'peEsq',
  'peDir',
  'cabeloCurto',
  'cabeloRaspado',
  'cabeloAfro',
  'cabeloRaboCavalo',
  'cabeloLongo',
  'cabeloCoque',
  'cabeloTrancas',
  'mochila',
  'avental',
] as const;

type NomeParte = (typeof PARTES)[number] | 'caboVassoura' | 'cerdasVassoura';
type RegistroMalhas = Record<NomeParte, THREE.InstancedMesh | null>;
type Malhas = Record<NomeParte, THREE.InstancedMesh>;

/**
 * Partes presentes em TODOS os 712 personagens (nunca têm instância com
 * escala 0 → matrizes nunca singulares) — só elas entram no picking.
 * Cabelos/saia/detalhePeitoF/mochila/avental/vassouras ficam de fora.
 */
const PARTES_CLICAVEIS: ReadonlySet<string> = new Set([
  'cabeca',
  'pescoco',
  'peito',
  'quadril',
  'bracoSupEsq',
  'bracoSupDir',
  'antebracoEsq',
  'antebracoDir',
  'maoEsq',
  'maoDir',
  'coxaEsq',
  'coxaDir',
  'canelaEsq',
  'canelaDir',
  'peEsq',
  'peDir',
]);

// ---------------------------------------------------------------------------
// Objetos temporários reutilizados no loop — ZERO alocação por frame.
// ---------------------------------------------------------------------------
const _e = new THREE.Euler(0, 0, 0, 'YXZ'); // yaw (facing/cabeça) antes de pitch/roll
const _q = new THREE.Quaternion();
const _Q_IDENTIDADE = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _um = new THREE.Vector3(1, 1, 1);
const _escala = new THREE.Vector3();
const _cor = new THREE.Color();
const _matZero = new THREE.Matrix4().makeScale(0, 0, 0);
const _mLocal = new THREE.Matrix4();
const _mParte = new THREE.Matrix4();
// Juntas do esqueleto (cinemática direta) — uma scratch por junta.
const _mBase = new THREE.Matrix4();
const _mPelvis = new THREE.Matrix4();
const _mChest = new THREE.Matrix4();
const _mNeck = new THREE.Matrix4();
const _mHead = new THREE.Matrix4();
const _mShE = new THREE.Matrix4();
const _mShD = new THREE.Matrix4();
const _mElE = new THREE.Matrix4();
const _mElD = new THREE.Matrix4();
const _mHipE = new THREE.Matrix4();
const _mHipD = new THREE.Matrix4();
const _mKneeE = new THREE.Matrix4();
const _mKneeD = new THREE.Matrix4();
const _mAnkE = new THREE.Matrix4();
const _mAnkD = new THREE.Matrix4();
const _mVassoura = new THREE.Matrix4();
const _poseAlvo: Pose = criarPoseNeutra(); // scratch compartilhado no loop

/**
 * Compõe a matriz-mundo de uma JUNTA: `pai` × local(translação, rotação YXZ).
 * Juntas têm escala 1 (a escala só entra nas partes, que são folhas).
 */
function junta(
  out: THREE.Matrix4,
  pai: THREE.Matrix4,
  tx: number,
  ty: number,
  tz: number,
  rx: number,
  ry: number,
  rz: number,
): void {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _v.set(tx, ty, tz);
  _mLocal.compose(_v, _q, _um);
  out.multiplyMatrices(pai, _mLocal);
}

/**
 * Compõe a matriz de UMA parte pendurada numa junta: centro da caixa em
 * (ox,oy,oz) no espaço da junta, dimensões (w,h,d). Grava na InstancedMesh.
 */
function parte(
  mesh: THREE.InstancedMesh,
  i: number,
  mJunta: THREE.Matrix4,
  ox: number,
  oy: number,
  oz: number,
  w: number,
  h: number,
  d: number,
): void {
  _v.set(ox, oy, oz);
  _mLocal.compose(_v, _Q_IDENTIDADE, _escala.set(w, h, d));
  _mParte.multiplyMatrices(mJunta, _mLocal);
  mesh.setMatrixAt(i, _mParte);
}

/**
 * Grava a malha de cabelo do estilo do personagem (os outros 6 estilos e o
 * caso CARECA ficam com a matriz zero do mount — não são tocados por frame).
 * Pivô = base da cabeça (topo do pescoço); a cabeça ocupa y ∈ [0, cabH].
 */
function definirCabelo(
  m: Malhas,
  i: number,
  estilo: number,
  mHead: THREE.Matrix4,
  cabW: number,
  cabH: number,
  cabD: number,
): void {
  switch (estilo) {
    case 0: // curto: camada cobrindo o topo da cabeça
      parte(m.cabeloCurto, i, mHead, 0, cabH * 0.86, -cabD * 0.04, cabW * 1.08, cabH * 0.3, cabD * 1.08);
      break;
    case 1: // raspado: camada fina rente ao topo
      parte(m.cabeloRaspado, i, mHead, 0, cabH * 0.92, -cabD * 0.02, cabW * 1.04, cabH * 0.16, cabD * 1.04);
      break;
    case 2: // afro: volume arredondado acima/ao redor da cabeça
      parte(m.cabeloAfro, i, mHead, 0, cabH * 0.72, -cabD * 0.08, cabW * 1.5, cabH * 0.85, cabD * 1.45);
      break;
    case 3: // rabo de cavalo: massa no topo que cai pela nuca
      parte(m.cabeloRaboCavalo, i, mHead, 0, cabH * 0.62, -cabD * 0.3, cabW * 1.06, cabH * 0.55, cabD * 1.35);
      break;
    case 4: // longo: cobre topo e laterais, descendo atrás até os ombros
      parte(m.cabeloLongo, i, mHead, 0, cabH * 0.45, -cabD * 0.18, cabW * 1.14, cabH * 1.25, cabD * 1.1);
      break;
    case 5: // coque: volume no topo-nuca (protuberância acima da cabeça)
      parte(m.cabeloCoque, i, mHead, 0, cabH * 0.78, -cabD * 0.22, cabW * 0.95, cabH * 0.75, cabD * 1.05);
      break;
    case 6: // tranças: massa que emoldura as laterais e desce pelas costas
      parte(m.cabeloTrancas, i, mHead, 0, cabH * 0.42, -cabD * 0.26, cabW * 1.16, cabH * 1.15, cabD * 0.9);
      break;
    default:
      break; // CARECA: nenhuma malha de cabelo
  }
}

/** Cor de cada parte a partir da paleta do personagem (+ sapato do rig). */
function corDaParte(parte: NomeParte, indice: number, rig: RigPersonagens): string {
  const paleta = ROSTER[indice].paleta;
  switch (parte) {
    case 'cabeca':
    case 'pescoco':
    case 'antebracoEsq':
    case 'antebracoDir':
    case 'maoEsq':
    case 'maoDir':
      return paleta.pele; // manga curta: antebraços e mãos na cor da pele
    case 'peito':
    case 'bracoSupEsq':
    case 'bracoSupDir':
    case 'detalhePeitoF':
      return paleta.camisa;
    case 'quadril':
    case 'coxaEsq':
    case 'coxaDir':
    case 'canelaEsq':
    case 'canelaDir':
    case 'saia':
      return paleta.calca;
    case 'peEsq':
    case 'peDir':
      return SAPATOS[rig.sapato[indice]];
    case 'mochila':
      return paleta.mochila ?? '#ffffff';
    case 'avental':
      return paleta.camisa; // avental na cor de trabalho do almoxarife
    case 'caboVassoura':
      return PALETTE.tronco;
    case 'cerdasVassoura':
      return PALETTE.carteira;
    default:
      return paleta.cabelo; // cabeloCurto…cabeloTrancas
  }
}

/**
 * Componente R3F com todas as InstancedMeshes dos personagens.
 * Deve ser montado DENTRO do <Canvas>.
 */
export function Characters(): JSX.Element {
  const malhas = useRef<RegistroMalhas>({
    cabeca: null,
    pescoco: null,
    peito: null,
    quadril: null,
    detalhePeitoF: null,
    saia: null,
    bracoSupEsq: null,
    bracoSupDir: null,
    antebracoEsq: null,
    antebracoDir: null,
    maoEsq: null,
    maoDir: null,
    coxaEsq: null,
    coxaDir: null,
    canelaEsq: null,
    canelaDir: null,
    peEsq: null,
    peDir: null,
    cabeloCurto: null,
    cabeloRaspado: null,
    cabeloAfro: null,
    cabeloRaboCavalo: null,
    cabeloLongo: null,
    cabeloCoque: null,
    cabeloTrancas: null,
    mochila: null,
    avental: null,
    caboVassoura: null,
    cerdasVassoura: null,
  });

  // Geometria/material ÚNICOS compartilhados por todas as partes.
  const geometria = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ flatShading: true }),
    [],
  );

  // Rig corporal (altura/biotipo/sexo/cabelo) — calculado UMA vez no mount.
  const rig = useMemo(construirRig, []);
  // Estado suavizado por personagem (criado uma vez; mutado no useFrame).
  const poses = useMemo(() => ROSTER.map(() => criarPoseNeutra()), []);
  const tempos = useMemo(() => new Float32Array(N), []);
  const yawCabeca = useMemo(() => new Float32Array(N), []);

  /** Ref callback: pinta as instâncias (instanceColor) 1×, zera as matrizes
   *  iniciais e registra para picking as partes presentes nos 712. */
  const configurarMalha =
    (nome: NomeParte, total: number) =>
    (m: THREE.InstancedMesh | null): void => {
      if (!m) return;
      malhas.current[nome] = m;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const ehVassoura = nome === 'caboVassoura' || nome === 'cerdasVassoura';
      for (let i = 0; i < total; i++) {
        _cor.set(corDaParte(nome, ehVassoura ? IDX_FAXINEIRO_0 + i : i, rig));
        m.setColorAt(i, _cor);
        m.setMatrixAt(i, _matZero); // começa invisível até o 1º useFrame
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      if (PARTES_CLICAVEIS.has(nome)) registrarMalhaPersonagem(m);
    };

  useFrame((_estado, deltaBruto) => {
    const reg = malhas.current;
    // Só roda quando TODAS as refs estiverem preenchidas (mount concluído).
    for (const nome in reg) {
      if (reg[nome as NomeParte] === null) return;
    }
    const m = reg as Malhas; // seguro: checado logo acima

    const delta = Math.min(deltaBruto, 0.1); // clamp p/ abas em segundo plano
    const k = 1 - Math.exp(-10 * delta); // fator de suavização (~10·delta)

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const px = SIM.pos[i3];
      const py = SIM.pos[i3 + 1];
      const pz = SIM.pos[i3 + 2];
      const f = SIM.facing[i];
      const anim = ANIM_STATES[SIM.anim[i]];
      const fase = SIM.phase[i];
      tempos[i] += delta;
      const t = tempos[i];

      // Pose-alvo + suavização (transições de animação sem "pulo").
      computePose(anim, fase, t, SIM.speed[i], _poseAlvo);
      const p = poses[i];
      suavizarPose(p, _poseAlvo, k);

      // Virada do rosto para o interlocutor durante 'talk' (slerp suave
      // do conjunto cabeça+cabelo em direção à posição do alvo).
      let yawAlvo = 0;
      const alvoTalk = SIM.talkTarget[i];
      if (alvoTalk >= 0 && anim === 'talk') {
        const dx = SIM.pos[alvoTalk * 3] - px;
        const dz = SIM.pos[alvoTalk * 3 + 2] - pz;
        if (dx * dx + dz * dz > 0.0025) {
          // Facing 0 = +Z → direção (sin f, cos f); yaw relativo ao corpo.
          const bruto = Math.atan2(dx, dz) - f;
          const rel = Math.atan2(Math.sin(bruto), Math.cos(bruto));
          yawAlvo = Math.max(-1.1, Math.min(1.1, rel));
        }
      }
      yawCabeca[i] += (yawAlvo - yawCabeca[i]) * k;
      const yawCab = yawCabeca[i] + p.cabecaRotY;

      // --- Leitura do rig (sem alocação) ---
      const quadrilPe = rig.quadrilPe[i];
      const quadrilSeg = rig.quadrilSeg[i];
      const peitoSeg = rig.peitoSeg[i];
      const pescocoC = rig.pescoco[i];
      const cabH = rig.cabecaH[i];
      const coxaC = rig.coxa[i];
      const canelaC = rig.canela[i];
      const peA = rig.peAltura[i];
      const peC = rig.peComp[i];
      const bracoSupC = rig.bracoSup[i];
      const antebracoC = rig.antebraco[i];
      const maoC = rig.mao[i];
      const ombrosW = rig.ombros[i];
      const peitoW = rig.peitoW[i];
      const peitoD = rig.peitoD[i];
      const quadrilW = rig.quadrilW[i];
      const quadrilD = rig.quadrilD[i];
      const bracoEsp = rig.bracoEsp[i];
      const pernaEsp = rig.pernaEsp[i];
      const pescocoEsp = rig.pescocoEsp[i];

      // --- Cinemática direta: base → pelve → peito → pescoço → cabeça ---
      const hipY = quadrilPe + (ALTURA_ASSENTO - quadrilPe) * p.sentar;

      _e.set(0, f, 0);
      _q.setFromEuler(_e);
      _v.set(px, py, pz);
      _mBase.compose(_v, _q, _um);

      // Pelve (torce com a passada; desliza lateralmente no repouso).
      junta(_mPelvis, _mBase, p.quadrilDeslX, hipY + p.bobY, 0, 0, p.quadrilRotY, 0);
      parte(m.quadril, i, _mPelvis, 0, quadrilSeg * 0.5, 0, quadrilW, quadrilSeg * 1.1, quadrilD);
      if (rig.saia[i] === 1) {
        // Saia: sai da cintura e cobre o início das coxas (levemente evasê).
        const saiaH = quadrilSeg + coxaC * 0.55;
        parte(m.saia, i, _mPelvis, 0, quadrilSeg - saiaH * 0.5, 0, quadrilW * 1.5, saiaH, quadrilD * 1.6);
      }

      // Peito (inclina/torce/balança conforme a pose).
      junta(_mChest, _mPelvis, 0, quadrilSeg, 0, p.troncoRotX, p.troncoRotY, p.troncoRotZ);
      parte(m.peito, i, _mChest, 0, peitoSeg * 0.5, 0, peitoW, peitoSeg * 1.06, peitoD);
      if (rig.detalheF[i] === 1) {
        parte(m.detalhePeitoF, i, _mChest, 0, peitoSeg * 0.32, peitoD * 0.5,
          peitoW * 0.52, peitoSeg * 0.26, peitoD * 0.42);
      }
      if (rig.mochila[i] === 1) {
        const er = rig.altura[i] / 1.7; // mochila proporcional ao aluno
        parte(m.mochila, i, _mChest, 0, peitoSeg * 0.45, -(peitoD * 0.5 + 0.07 * er),
          0.32 * er, 0.38 * er, 0.14 * er);
      }
      if (rig.avental[i] === 1) {
        // Avental do almoxarife: placa frontal pendurada no tronco, do peito
        // (abaixo dos ombros) até o meio das coxas, rente à frente do corpo.
        const avTopo = peitoSeg * 0.78;
        const avBase = -(quadrilSeg + coxaC * 0.4);
        parte(m.avental, i, _mChest, 0, (avTopo + avBase) * 0.5, peitoD * 0.5 + 0.015,
          peitoW * 0.7, avTopo - avBase, 0.03);
      }

      // Pescoço e cabeça (a cabeça gira com a pose + yaw do 'talk').
      junta(_mNeck, _mChest, 0, peitoSeg, 0, 0, 0, 0);
      parte(m.pescoco, i, _mNeck, 0, pescocoC * 0.5, 0, pescocoEsp, pescocoC * 1.2, pescocoEsp);
      junta(_mHead, _mNeck, 0, pescocoC, 0, p.cabecaRotX, yawCab, p.cabecaRotZ);
      const cabW = cabH * 0.82;
      const cabD = cabH * 0.92;
      parte(m.cabeca, i, _mHead, 0, cabH * 0.5, 0, cabW, cabH, cabD);
      definirCabelo(m, i, rig.cabelo[i], _mHead, cabW, cabH, cabD);

      // --- Braços: ombro → cotovelo (punho = fim do antebraço) ---
      const ombroY = peitoSeg * 0.88;
      junta(_mShE, _mChest, -ombrosW * 0.5, ombroY, 0, p.ombroEsqX, 0, p.ombroEsqZ);
      parte(m.bracoSupEsq, i, _mShE, 0, -bracoSupC * 0.5, 0, bracoEsp, bracoSupC * 1.08, bracoEsp);
      junta(_mElE, _mShE, 0, -bracoSupC, 0, -p.cotoveloEsq, 0, 0);
      parte(m.antebracoEsq, i, _mElE, 0, -antebracoC * 0.5, 0,
        bracoEsp * 0.88, antebracoC * 1.08, bracoEsp * 0.88);
      parte(m.maoEsq, i, _mElE, 0, -(antebracoC + maoC * 0.5), 0.008,
        bracoEsp * 0.92, maoC * 1.05, bracoEsp * 1.15);

      junta(_mShD, _mChest, ombrosW * 0.5, ombroY, 0, p.ombroDirX, 0, p.ombroDirZ);
      parte(m.bracoSupDir, i, _mShD, 0, -bracoSupC * 0.5, 0, bracoEsp, bracoSupC * 1.08, bracoEsp);
      junta(_mElD, _mShD, 0, -bracoSupC, 0, -p.cotoveloDir, 0, 0);
      parte(m.antebracoDir, i, _mElD, 0, -antebracoC * 0.5, 0,
        bracoEsp * 0.88, antebracoC * 1.08, bracoEsp * 0.88);
      parte(m.maoDir, i, _mElD, 0, -(antebracoC + maoC * 0.5), 0.008,
        bracoEsp * 0.92, maoC * 1.05, bracoEsp * 1.15);

      // --- Pernas: quadril → joelho → tornozelo ---
      const pernaX = quadrilW * 0.32;
      junta(_mHipE, _mPelvis, -pernaX, -0.01, 0, p.coxaEsqX, 0, 0);
      parte(m.coxaEsq, i, _mHipE, 0, -coxaC * 0.5, 0, pernaEsp, coxaC * 1.06, pernaEsp * 1.12);
      junta(_mKneeE, _mHipE, 0, -coxaC, 0, p.joelhoEsq, 0, 0);
      parte(m.canelaEsq, i, _mKneeE, 0, -canelaC * 0.5, 0,
        pernaEsp * 0.85, canelaC * 1.06, pernaEsp * 0.95);
      junta(_mAnkE, _mKneeE, 0, -canelaC, 0, p.peEsqX, 0, 0);
      parte(m.peEsq, i, _mAnkE, 0, -peA * 0.5, peC * 0.28, pernaEsp * 1.05, peA, peC);

      junta(_mHipD, _mPelvis, pernaX, -0.01, 0, p.coxaDirX, 0, 0);
      parte(m.coxaDir, i, _mHipD, 0, -coxaC * 0.5, 0, pernaEsp, coxaC * 1.06, pernaEsp * 1.12);
      junta(_mKneeD, _mHipD, 0, -coxaC, 0, p.joelhoDir, 0, 0);
      parte(m.canelaDir, i, _mKneeD, 0, -canelaC * 0.5, 0,
        pernaEsp * 0.85, canelaC * 1.06, pernaEsp * 0.95);
      junta(_mAnkD, _mKneeD, 0, -canelaC, 0, p.peDirX, 0, 0);
      parte(m.peDir, i, _mAnkD, 0, -peA * 0.5, peC * 0.28, pernaEsp * 1.05, peA, peC);

      // --- Vassoura (apenas os 2 faxineiros, e só durante 'sweep'):
      // alinhada ao PONTO MÉDIO DAS MÃOS (não mais ao tronco). ---
      if (i >= IDX_FAXINEIRO_0 && i < IDX_FAXINEIRO_0 + N_VASSOURAS) {
        const bi = i - IDX_FAXINEIRO_0;
        if (anim === 'sweep') {
          _v.set(0, -(antebracoC + maoC * 0.4), 0.02).applyMatrix4(_mElE);
          _v2.set(0, -(antebracoC + maoC * 0.4), 0.02).applyMatrix4(_mElD);
          _v.add(_v2).multiplyScalar(0.5); // ponto médio das mãos
          const bal = Math.sin(t * 2.2 + fase * TAU);
          _e.set(-0.72 + bal * 0.06, f, bal * 0.1);
          _q.setFromEuler(_e);
          _mVassoura.compose(_v, _q, _um);
          parte(m.caboVassoura, bi, _mVassoura, 0, -0.62, 0, 0.035, 1.3, 0.035);
          parte(m.cerdasVassoura, bi, _mVassoura, 0, -1.28, 0.02, 0.3, 0.09, 0.09);
        } else {
          m.caboVassoura.setMatrixAt(bi, _matZero);
          m.cerdasVassoura.setMatrixAt(bi, _matZero);
        }
      }
    }

    // Um upload por malha por frame.
    m.cabeca.instanceMatrix.needsUpdate = true;
    m.pescoco.instanceMatrix.needsUpdate = true;
    m.peito.instanceMatrix.needsUpdate = true;
    m.quadril.instanceMatrix.needsUpdate = true;
    m.detalhePeitoF.instanceMatrix.needsUpdate = true;
    m.saia.instanceMatrix.needsUpdate = true;
    m.bracoSupEsq.instanceMatrix.needsUpdate = true;
    m.bracoSupDir.instanceMatrix.needsUpdate = true;
    m.antebracoEsq.instanceMatrix.needsUpdate = true;
    m.antebracoDir.instanceMatrix.needsUpdate = true;
    m.maoEsq.instanceMatrix.needsUpdate = true;
    m.maoDir.instanceMatrix.needsUpdate = true;
    m.coxaEsq.instanceMatrix.needsUpdate = true;
    m.coxaDir.instanceMatrix.needsUpdate = true;
    m.canelaEsq.instanceMatrix.needsUpdate = true;
    m.canelaDir.instanceMatrix.needsUpdate = true;
    m.peEsq.instanceMatrix.needsUpdate = true;
    m.peDir.instanceMatrix.needsUpdate = true;
    m.cabeloCurto.instanceMatrix.needsUpdate = true;
    m.cabeloRaspado.instanceMatrix.needsUpdate = true;
    m.cabeloAfro.instanceMatrix.needsUpdate = true;
    m.cabeloRaboCavalo.instanceMatrix.needsUpdate = true;
    m.cabeloLongo.instanceMatrix.needsUpdate = true;
    m.cabeloCoque.instanceMatrix.needsUpdate = true;
    m.cabeloTrancas.instanceMatrix.needsUpdate = true;
    m.mochila.instanceMatrix.needsUpdate = true;
    m.avental.instanceMatrix.needsUpdate = true;
    m.caboVassoura.instanceMatrix.needsUpdate = true;
    m.cerdasVassoura.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="personagens">
      {PARTES.map((nome) => (
        <instancedMesh
          key={nome}
          ref={configurarMalha(nome, N)}
          args={[geometria, material, N]}
          frustumCulled={false}
          castShadow
        />
      ))}
      <instancedMesh
        ref={configurarMalha('caboVassoura', N_VASSOURAS)}
        args={[geometria, material, N_VASSOURAS]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={configurarMalha('cerdasVassoura', N_VASSOURAS)}
        args={[geometria, material, N_VASSOURAS]}
        frustumCulled={false}
      />
    </group>
  );
}
