/**
 * Characters.tsx — RENDER INSTANCIADO dos 79 personagens da escola.
 *
 * Uma THREE.InstancedMesh POR PARTE DO CORPO (79 instâncias cada):
 * cabeça, cabelo, tronco, braçoEsq, braçoDir, pernaEsq, pernaDir, mochila
 * (~8 draw calls), mais 2 malhas pequenas para as vassouras dos faxineiros.
 *
 * A cada frame (useFrame) as posições/animações são lidas DIRETO dos buffers
 * SIM (contracts/simBuffer) — nada de React state por frame. As poses-alvo
 * vêm de animations.ts (computePose) e são suavizadas por personagem
 * (suavizarPose, fator ~10·delta) para transições sem "pulos".
 *
 * Proporções low-poly (adulto ≈ 1,69 m; aluno = escala 0,85):
 * pernas 0,80 · tronco 0,55 · cabeça 0,26 + cabelo. Geometria Box unitária
 * compartilhada; escalas/rotações entram na matriz de cada instância.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ANIM_STATES, PALETTE, ROSTER, SIM } from '../contracts';
import { computePose, criarPoseNeutra, suavizarPose, type Pose } from './animations';
import { registrarMalhaPersonagem } from './picking';

const N = ROSTER.length; // 79
const TAU = Math.PI * 2;

/** Índice do primeiro faxineiro no ROSTER (76, 77) — donos das vassouras. */
const IDX_FAXINEIRO_0 = 76;
const N_VASSOURAS = 2;

type NomeParte =
  | 'cabeca'
  | 'cabelo'
  | 'tronco'
  | 'bracoEsq'
  | 'bracoDir'
  | 'pernaEsq'
  | 'pernaDir'
  | 'mochila'
  | 'caboVassoura'
  | 'cerdasVassoura';

/** Dimensões (m) das partes, para um adulto (alunos usam escala 0,85). */
const DIMS = {
  cabeca: { w: 0.26, h: 0.26, d: 0.26 },
  cabelo: { w: 0.29, h: 0.13, d: 0.29 },
  tronco: { w: 0.5, h: 0.55, d: 0.28 },
  braco: { w: 0.12, h: 0.55, d: 0.12 },
  perna: { w: 0.14, h: 0.8, d: 0.16 },
  mochila: { w: 0.34, h: 0.4, d: 0.15 },
  caboVassoura: { w: 0.04, h: 1.3, d: 0.04 },
  cerdasVassoura: { w: 0.28, h: 0.08, d: 0.08 },
} as const;

/** Altura do quadril: 0,80 m em pé → 0,45 m sentado (assento da carteira). */
const QUADRIL_PE = 0.8;
const QUADRIL_SENTADO = 0.45;

// ---------------------------------------------------------------------------
// Objetos temporários reutilizados no loop — ZERO alocação por frame.
// ---------------------------------------------------------------------------
const _dummy = new THREE.Object3D();
_dummy.rotation.order = 'YXZ'; // yaw (facing/cabeça) antes de pitch/roll
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3();
const _cor = new THREE.Color();
const _matZero = new THREE.Matrix4().makeScale(0, 0, 0);
const _poseAlvo: Pose = criarPoseNeutra(); // scratch compartilhado no loop

/**
 * Compõe a matriz de UMA parte de UM personagem e grava na InstancedMesh.
 *
 * @param px,by,pz   posição-base do personagem (by já inclui piso + bob)
 * @param cosf,sinf,f cosseno/seno/ângulo do facing (rotação Y)
 * @param s          escala do personagem (1 adulto · 0,85 aluno)
 * @param lx,ly,lz   PIVÔ da parte no espaço local (sem escala)
 * @param ox,oy,oz   offset do CENTRO da caixa a partir do pivô (rotacionado)
 * @param rx,ry,rz   rotações locais da parte (ry soma-se ao facing)
 * @param w,h,d      dimensões da caixa (sem a escala do personagem)
 */
function definirParte(
  mesh: THREE.InstancedMesh,
  i: number,
  px: number,
  by: number,
  pz: number,
  cosf: number,
  sinf: number,
  f: number,
  s: number,
  lx: number,
  ly: number,
  lz: number,
  ox: number,
  oy: number,
  oz: number,
  rx: number,
  ry: number,
  rz: number,
  w: number,
  h: number,
  d: number,
): void {
  // Pivô no mundo: rotação Y (facing) do offset local + translação.
  const wx = px + (lx * cosf + lz * sinf) * s;
  const wy = by + ly * s;
  const wz = pz + (-lx * sinf + lz * cosf) * s;
  _euler.set(rx, f + ry, rz);
  _v.set(ox * s, oy * s, oz * s).applyEuler(_euler);
  _dummy.position.set(wx + _v.x, wy + _v.y, wz + _v.z);
  _dummy.rotation.copy(_euler);
  _dummy.scale.set(w * s, h * s, d * s);
  _dummy.updateMatrix();
  mesh.setMatrixAt(i, _dummy.matrix);
}

/** Cor de cada parte a partir da paleta do personagem. */
function corDaParte(parte: NomeParte, indiceRoster: number): string {
  const paleta = ROSTER[indiceRoster].paleta;
  switch (parte) {
    case 'cabeca':
      return paleta.pele;
    case 'cabelo':
      return paleta.cabelo;
    case 'tronco':
    case 'bracoEsq':
    case 'bracoDir':
      return paleta.camisa;
    case 'pernaEsq':
    case 'pernaDir':
      return paleta.calca;
    case 'mochila':
      return paleta.mochila ?? '#ffffff';
    case 'caboVassoura':
      return PALETTE.tronco;
    case 'cerdasVassoura':
      return PALETTE.carteira;
  }
}

/**
 * Componente R3F com todas as InstancedMeshes dos personagens.
 * Deve ser montado DENTRO do <Canvas>.
 */
export function Characters(): JSX.Element {
  const malhas = useRef<Record<NomeParte, THREE.InstancedMesh | null>>({
    cabeca: null,
    cabelo: null,
    tronco: null,
    bracoEsq: null,
    bracoDir: null,
    pernaEsq: null,
    pernaDir: null,
    mochila: null,
    caboVassoura: null,
    cerdasVassoura: null,
  });

  // Geometria/material ÚNICOS compartilhados por todas as partes.
  const geometria = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ flatShading: true }),
    [],
  );

  // Estado suavizado por personagem (criado uma vez; mutado no useFrame).
  const poses = useMemo(() => ROSTER.map(() => criarPoseNeutra()), []);
  const tempos = useMemo(() => new Float32Array(N), []);
  const yawCabeca = useMemo(() => new Float32Array(N), []);
  const escalas = useMemo(
    () => Float32Array.from(ROSTER, (p) => (p.papel === 'ALUNO' ? 0.85 : 1)),
    [],
  );
  const fatorMochila = useMemo(
    () => Float32Array.from(ROSTER, (p) => (p.papel === 'ALUNO' ? 1 : 0)),
    [],
  );

  /** Ref callback: pinta as instâncias (instanceColor), zera as matrizes
   *  iniciais e registra a malha para picking. */
  const configurarMalha =
    (parte: NomeParte, total: number) =>
    (m: THREE.InstancedMesh | null): void => {
      if (!m) return;
      malhas.current[parte] = m;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const ehVassoura = parte === 'caboVassoura' || parte === 'cerdasVassoura';
      for (let i = 0; i < total; i++) {
        _cor.set(corDaParte(parte, ehVassoura ? IDX_FAXINEIRO_0 + i : i));
        m.setColorAt(i, _cor);
        m.setMatrixAt(i, _matZero); // começa invisível até o 1º useFrame
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      // Mochila fora do picking (escala 0 em não-alunos → matriz singular);
      // vassouras também não são clicáveis.
      if (parte !== 'mochila' && !ehVassoura) registrarMalhaPersonagem(m);
    };

  useFrame((_estado, deltaBruto) => {
    const {
      cabeca,
      cabelo,
      tronco,
      bracoEsq,
      bracoDir,
      pernaEsq,
      pernaDir,
      mochila,
      caboVassoura,
      cerdasVassoura,
    } = malhas.current;
    if (
      !cabeca ||
      !cabelo ||
      !tronco ||
      !bracoEsq ||
      !bracoDir ||
      !pernaEsq ||
      !pernaDir ||
      !mochila ||
      !caboVassoura ||
      !cerdasVassoura
    ) {
      return;
    }

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

      const s = escalas[i];
      const cosf = Math.cos(f);
      const sinf = Math.sin(f);
      const q = QUADRIL_PE + (QUADRIL_SENTADO - QUADRIL_PE) * p.sentar;
      const by = py + p.bobY * s;
      const yawCab = yawCabeca[i] + p.cabecaRotY;

      // Pernas (pivô no quadril; centro 0,40 abaixo).
      definirParte(pernaEsq, i, px, by, pz, cosf, sinf, f, s, -0.09, q, 0, 0, -0.4, 0,
        p.pernaEsqRotX, 0, 0, DIMS.perna.w, DIMS.perna.h, DIMS.perna.d);
      definirParte(pernaDir, i, px, by, pz, cosf, sinf, f, s, 0.09, q, 0, 0, -0.4, 0,
        p.pernaDirRotX, 0, 0, DIMS.perna.w, DIMS.perna.h, DIMS.perna.d);

      // Tronco (pivô no quadril; centro 0,275 acima).
      definirParte(tronco, i, px, by, pz, cosf, sinf, f, s, 0, q, 0, 0, 0.275, 0,
        p.troncoRotX, 0, p.troncoRotZ, DIMS.tronco.w, DIMS.tronco.h, DIMS.tronco.d);

      // Braços (pivô no ombro; centro 0,26 abaixo).
      definirParte(bracoEsq, i, px, by, pz, cosf, sinf, f, s, -0.31, q + 0.5, 0, 0, -0.26, 0,
        p.bracoEsqRotX, 0, p.bracoEsqRotZ, DIMS.braco.w, DIMS.braco.h, DIMS.braco.d);
      definirParte(bracoDir, i, px, by, pz, cosf, sinf, f, s, 0.31, q + 0.5, 0, 0, -0.26, 0,
        p.bracoDirRotX, 0, p.bracoDirRotZ, DIMS.braco.w, DIMS.braco.h, DIMS.braco.d);

      // Cabeça e cabelo (pivô no pescoço; giram juntos — inclusive no 'talk').
      definirParte(cabeca, i, px, by, pz, cosf, sinf, f, s, 0, q + 0.55, 0, 0, 0.16, 0,
        p.cabecaRotX, yawCab, 0, DIMS.cabeca.w, DIMS.cabeca.h, DIMS.cabeca.d);
      definirParte(cabelo, i, px, by, pz, cosf, sinf, f, s, 0, q + 0.55, 0, 0, 0.27, -0.01,
        p.cabecaRotX, yawCab, 0, DIMS.cabelo.w, DIMS.cabelo.h, DIMS.cabelo.d);

      // Mochila (colada no tronco; escala 0 para não-alunos).
      const fm = fatorMochila[i];
      definirParte(mochila, i, px, by, pz, cosf, sinf, f, s, 0, q, 0, 0, 0.34, -0.225,
        p.troncoRotX, 0, 0, DIMS.mochila.w * fm, DIMS.mochila.h * fm, DIMS.mochila.d * fm);

      // Vassoura (apenas os 2 faxineiros, e só durante 'sweep').
      if (i >= IDX_FAXINEIRO_0 && i < IDX_FAXINEIRO_0 + N_VASSOURAS) {
        const bi = i - IDX_FAXINEIRO_0;
        if (anim === 'sweep') {
          const bal = Math.sin(t * 2.2 + fase * TAU) * 0.12;
          definirParte(caboVassoura, bi, px, by, pz, cosf, sinf, f, s,
            0.12, q + 0.15, 0.28, 0, -0.45, 0, -0.55 + bal, 0, 0,
            DIMS.caboVassoura.w, DIMS.caboVassoura.h, DIMS.caboVassoura.d);
          definirParte(cerdasVassoura, bi, px, by, pz, cosf, sinf, f, s,
            0.12, q + 0.15, 0.28, 0, -1.22, 0, -0.55 + bal, 0, 0,
            DIMS.cerdasVassoura.w, DIMS.cerdasVassoura.h, DIMS.cerdasVassoura.d);
        } else {
          caboVassoura.setMatrixAt(bi, _matZero);
          cerdasVassoura.setMatrixAt(bi, _matZero);
        }
      }
    }

    cabeca.instanceMatrix.needsUpdate = true;
    cabelo.instanceMatrix.needsUpdate = true;
    tronco.instanceMatrix.needsUpdate = true;
    bracoEsq.instanceMatrix.needsUpdate = true;
    bracoDir.instanceMatrix.needsUpdate = true;
    pernaEsq.instanceMatrix.needsUpdate = true;
    pernaDir.instanceMatrix.needsUpdate = true;
    mochila.instanceMatrix.needsUpdate = true;
    caboVassoura.instanceMatrix.needsUpdate = true;
    cerdasVassoura.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="personagens">
      <instancedMesh
        ref={configurarMalha('cabeca', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={configurarMalha('cabelo', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={configurarMalha('tronco', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={configurarMalha('bracoEsq', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={configurarMalha('bracoDir', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={configurarMalha('pernaEsq', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={configurarMalha('pernaDir', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
        castShadow
      />
      <instancedMesh
        ref={configurarMalha('mochila', N)}
        args={[geometria, material, N]}
        frustumCulled={false}
      />
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
