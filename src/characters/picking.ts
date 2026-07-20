/**
 * picking.ts — INTERAÇÃO por clique/toque (modelo mouse-first — ver
 * contracts/store.ts):
 *
 * - Só age no modo 'livre' (mouse solto). Nos modos com pointer lock
 *   ('voo'/'possuido') o clique é MOVIMENTO (LMB = frente) e não há cursor.
 * - Clique em PERSONAGEM → POSSE (3ª pessoa): iniciarPosse(idx) + pedido de
 *   pointer lock — o NPC sai da simulação (ver src/player/possessao.ts e o
 *   skip em simulation/step.ts). Estando já possuído de outro, troca de alvo.
 * - Clique no VAZIO → volta ao modo VOO (pointer lock); se estiver possuído,
 *   o NPC é liberado e retoma a simulação da posição atual (replaneja).
 * - Filtro de arrasto: pointerdown → click com > 6 px de deslocamento não
 *   conta como clique (protege contra gestos sujos, mesmo com a câmera fixa).
 *
 * `interagirNoPonto(x, y)` é a entrada imperativa ÚNICA (clique do mouse e
 * toqueTela da API touch passam por ela); usa a câmera/canvas atuais
 * registrados pelo <CharacterPicker/> no mount (dentro do <Canvas>).
 *
 * `Characters.tsx` registra suas InstancedMeshes em `characterMeshes` via
 * `registrarMalhaPersonagem` (só as partes presentes em TODOS os 712 —
 * cabelo/saia/mochila etc. têm instâncias de escala 0, que atrapalhariam o
 * raycast). instanceId do raio == índice estável no ROSTER/SIM.
 *
 * O store é acessado via `useSchoolStore.getState()` no momento do gesto —
 * nenhum subscribe por frame.
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { ROSTER } from '../contracts';
import { iniciarPosse, soltarPosseEVoar } from '../player/possessao';
import { pedirTravaPointer } from '../player/pointerLock';
import { useSchoolStore } from '../state/useSchoolStore';

/**
 * Malhas instanciadas clicáveis dos personagens (preenchidas por Characters).
 * Só entram as partes presentes em TODOS os 712 personagens (cabeça, pescoço,
 * peito, quadril, braços, mãos, pernas, pés): cabelos, saia, detalhePeitoF,
 * mochila, avental e vassouras têm instâncias com escala 0 (matriz singular),
 * o que atrapalharia o raycast — ficam FORA da lista.
 */
export const characterMeshes: THREE.InstancedMesh[] = [];

/** Registra uma InstancedMesh de personagem para picking (idempotente). */
export function registrarMalhaPersonagem(m: THREE.InstancedMesh): void {
  if (!characterMeshes.includes(m)) characterMeshes.push(m);
}

// --- Alvos do raycast imperativo (registrados pelo CharacterPicker) ---
let refCanvas: HTMLCanvasElement | null = null;
let refCamera: THREE.Camera | null = null;
// Scratches do raycast (reuso — sem alocação por clique).
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** Índice ROSTER/SIM do personagem sob o ponto (coords de cliente), ou null. */
function personagemNoPonto(el: HTMLCanvasElement, cam: THREE.Camera, x: number, y: number): number | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  if (characterMeshes.length === 0) return null;
  raycaster.setFromCamera(ndc, cam);
  const hits = raycaster.intersectObjects(characterMeshes, false);
  // Os hits vêm ordenados por distância; o primeiro com instanceId vale.
  for (const h of hits) {
    const idx = h.instanceId;
    if (idx !== undefined && idx >= 0 && idx < ROSTER.length) return idx;
  }
  return null;
}

/**
 * AÇÃO do clique/toque em coords de cliente (CSS px) — única porta de
 * interação (listener de click do canvas E toqueTela da API touch).
 * No-Op fora do modo 'livre' (nos modos com pointer lock não há cursor).
 */
export function interagirNoPonto(clientX: number, clientY: number): void {
  const st = useSchoolStore.getState();
  if (st.modoCam !== 'livre') return;
  const el = refCanvas;
  const cam = refCamera;
  if (!el || !cam) return; // picker ainda não montou (defensivo)

  const idx = personagemNoPonto(el, cam, clientX, clientY);
  if (idx !== null) {
    // Personagem: possui (a posse troca de alvo sozinha, se já houver um).
    iniciarPosse(idx);
  } else if (st.possuidoIdx !== null) {
    // Vazio estando possuído: libera o NPC (retoma a simulação dali) e voa.
    soltarPosseEVoar();
  } else {
    // Vazio sem posse: simplesmente volta a voar.
    st.entrarVoo();
  }
  // A trava é pedida no MESMO gesto do usuário (exigência dos browsers);
  // se falhar (cooldown pós-ESC), o PlayerRig/chip orientam o próximo clique.
  pedirTravaPointer(el);
}

/**
 * Componente "invisível": instala os listeners de clique no canvas e
 * registra câmera/canvas para o `interagirNoPonto` imperativo.
 * Deve ser montado dentro do <Canvas> (usa useThree).
 */
export function CharacterPicker(): null {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    refCanvas = el;
    refCamera = camera;

    // Dados do pointerdown, para o filtro de arrasto (> 6 px não é clique).
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent): void => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onClick = (e: MouseEvent): void => {
      // Arrasto do ponteiro entre down e click: não é intenção de interagir.
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) return;
      interagirNoPonto(e.clientX, e.clientY);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClick);
      if (refCanvas === el) refCanvas = null;
      if (refCamera === camera) refCamera = null;
    };
  }, [gl, camera]);

  return null;
}
