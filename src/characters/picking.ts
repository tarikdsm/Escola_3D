/**
 * picking.ts — SELEÇÃO DE PERSONAGENS por clique/toque.
 *
 * `Characters.tsx` registra suas InstancedMeshes em `characterMeshes`;
 * `CharacterPicker` (montado DENTRO do <Canvas>) escuta os eventos do
 * canvas e faz raycast contra essas malhas:
 *
 * - modo 'aereo' (sem pointer lock): evento 'click' com as coords do ponteiro;
 * - modo 'andar' (pointer lock ativo): 'pointerdown' com o raio saindo do
 *   CENTRO da tela (a mira).
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
 * A mochila fica FORA da lista: instâncias de não-alunos têm escala 0
 * (matriz singular atrapalharia o raycast).
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
    // Posição do pointerdown, para distinguir clique de arrasto de câmera.
    let downX = 0;
    let downY = 0;

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
      downX = e.clientX;
      downY = e.clientY;
      // Modo 'andar': pointer lock ativo → mira no centro da tela.
      if (document.pointerLockElement === el) {
        selecionarNoPonto(e.clientX, e.clientY, true);
      }
    };

    const onClick = (e: MouseEvent): void => {
      // Com pointer lock, o pointerdown acima já tratou (evita dupla seleção).
      if (document.pointerLockElement === el) return;
      // Ignora "clique" que na verdade foi arrasto de câmera (orbit/pan).
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) return;
      selecionarNoPonto(e.clientX, e.clientY, false);
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
