/**
 * picking.ts — SELEÇÃO DE PERSONAGENS por clique/toque.
 *
 * `Characters.tsx` registra suas InstancedMeshes em `characterMeshes`;
 * `CharacterPicker` (montado DENTRO do <Canvas>) escuta os eventos do
 * canvas e faz raycast contra essas malhas:
 *
 * - modo 'aereo' (sem pointer lock): evento 'click' com as coords do ponteiro;
 * - modo 'andar' (pointer lock ativo): raio saindo do CENTRO da tela (a mira).
 *
 * Como segurar LMB/RMB agora MOVE a câmera/personagem em todos os modos, a
 * seleção só acontece no 'click' (soltar o botão) e é IGNORADA quando:
 * - a pressão durou > 400 ms (segurou para se mover); OU
 * - a câmera se moveu > 0,05 m entre pointerdown e click; OU
 * - o ponteiro se moveu > 6 px (arrasto de câmera — regra antiga, mantida).
 *
 * instanceId do raio == índice estável no ROSTER → `selecionar(ROSTER[idx].id)`.
 * Clique fora de qualquer personagem → `selecionar(null)`.
 *
 * O store é acessado via `useSchoolStore.getState()` no momento do clique —
 * nenhum subscribe por frame.
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { ROSTER } from '../contracts';
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

/**
 * Componente "invisível": só instala os listeners de clique no canvas.
 * Deve ser montado dentro do <Canvas> (usa useThree).
 */
export function CharacterPicker(): null {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    // Dados do pointerdown, para distinguir clique de "segurar para mover":
    // posição e instante do toque + posição da câmera naquele momento.
    let downX = 0;
    let downY = 0;
    let downT = 0;
    const downCamPos = new THREE.Vector3();

    const selecionarNoPonto = (clientX: number, clientY: number, centro: boolean): void => {
      if (centro) {
        ndc.set(0, 0);
      } else {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        ndc.set(
          ((clientX - r.left) / r.width) * 2 - 1,
          -((clientY - r.top) / r.height) * 2 + 1,
        );
      }
      if (characterMeshes.length === 0) return;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(characterMeshes, false);
      // Os hits vêm ordenados por distância; o primeiro com instanceId vale.
      let id: string | null = null;
      for (const h of hits) {
        const idx = h.instanceId;
        if (idx !== undefined && idx >= 0 && idx < ROSTER.length) {
          id = ROSTER[idx].id;
          break;
        }
      }
      useSchoolStore.getState().selecionar(id);
    };

    const onPointerDown = (e: PointerEvent): void => {
      // Só registra; a seleção acontece no 'click' (soltar), após os filtros.
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
      downCamPos.copy(camera.position);
    };

    const onClick = (e: MouseEvent): void => {
      // Com pointer lock ('andar'/'voar'), a mira é o centro da tela.
      const centro = document.pointerLockElement === el;
      // Segurou o botão para se mover (> 400 ms): não é intenção de selecionar.
      if (performance.now() - downT > 400) return;
      // A câmera se moveu durante a pressão (voar/andar/avanço aéreo): idem.
      if (downCamPos.distanceToSquared(camera.position) > 0.05 * 0.05) return;
      // Arrasto do ponteiro (órbita no aéreo) também não é clique. Com pointer
      // lock o clientX/Y não é significativo, então o teste só vale fora dele.
      if (!centro && Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) return;
      selecionarNoPonto(e.clientX, e.clientY, centro);
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('click', onClick);
    };
  }, [gl, camera]);

  return null;
}
