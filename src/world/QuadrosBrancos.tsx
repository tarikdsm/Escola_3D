/**
 * QuadrosBrancos.tsx — Superfícies texturizadas dos quadros brancos.
 *
 * Para cada sala, cria UMA vez (useMemo) o quadro da fábrica pura
 * `criarQuadroBranco` (canvas offscreen + CanvasTexture) e o aplica como
 * `map` de um plano fino na âncora QUADROS[salaId] (parede norte, normal +Z),
 * com roughness 0,35 (leve brilho de superfície melamínica).
 *
 * Um ÚNICO useFrame, estrangulado a ~3 Hz (acumulando delta), lê o relógio do
 * jogo via `useSchoolStore.getState()` (SEM subscribe) e revela o conteúdo:
 * - CHEGADA → p = 0 (quadro limpo);
 * - AULA_1  → p = clamp((clockMin − 450) / 20, 0, 1) — o "professor" escreve
 *   das 7h30 às 7h50 do jogo;
 * - demais períodos → p = 1 (fica escrito até o fim do dia; no wrap 12h→7h,
 *   CHEGADA volta a p = 0 e o quadro "é apagado" sozinho).
 *
 * DECISÃO (documentada): NÃO há `MolduraQuadroBranco` exportado — as molduras
 * de alumínio, bandejas, marcadores e apagadores físicos ficam nas integrações
 * (térreo: Caixas individuais por sala; superior: conjuntos instanciados),
 * pois cada piso já tem seu padrão de renderização. Este componente desenha
 * APENAS as superfícies escritas. Unmount descarta as texturas (dispose).
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { QUADROS } from '../contracts/layout';
import { useSchoolStore } from '../state/useSchoolStore';
import { criarQuadroBranco } from './quadroBranco';

/** Intervalo do estrangulamento da revelação (~3 Hz). */
const PASSO_REVELACAO = 0.33;

interface QuadrosBrancosProps {
  /** Salas que recebem quadro (ids de IDS_SALAS_AULA; array estável). */
  salaIds: readonly string[];
  /** Largura × altura da superfície em metros (default 2,4 × 1,15 — térreo). */
  tamanho?: readonly [number, number];
  /** Distância da superfície à âncora, ao longo da normal (default 0,03). */
  offsetZ?: number;
}

export function QuadrosBrancos({ salaIds, tamanho = [2.4, 1.15], offsetZ = 0.03 }: QuadrosBrancosProps) {
  // Um quadro (canvas + textura) por sala — criado uma única vez.
  const quadros = useMemo(
    () => salaIds.map((salaId) => ({ salaId, qb: criarQuadroBranco(salaId), q: QUADROS[salaId] })),
    [salaIds],
  );

  // Descarta texturas/canvases ao desmontar.
  useEffect(() => {
    return () => {
      for (const { qb } of quadros) qb.dispose();
    };
  }, [quadros]);

  // Revelação estrangulada: começa com o acumulador "cheio" p/ revelar já no
  // 1º frame (evita 1 frame de quadro em branco-fora-do-período-CHEGADA).
  const acumulado = useRef(PASSO_REVELACAO);
  useFrame((_, delta) => {
    acumulado.current += delta;
    if (acumulado.current < PASSO_REVELACAO) return;
    acumulado.current = 0;
    const { clockMin, periodo } = useSchoolStore.getState();
    let p: number;
    if (periodo === 'CHEGADA') p = 0;
    else if (periodo === 'AULA_1') p = Math.min(1, Math.max(0, (clockMin - 450) / 20));
    else p = 1;
    for (const { qb } of quadros) qb.revelar(p);
  });

  return (
    <group name="quadros-brancos">
      {quadros.map(({ salaId, qb, q }) => {
        const rotY = Math.atan2(q.normal[0], q.normal[2]);
        return (
          <mesh
            key={salaId}
            position={[
              q.pos[0] + q.normal[0] * offsetZ,
              q.pos[1] + q.normal[1] * offsetZ,
              q.pos[2] + q.normal[2] * offsetZ,
            ]}
            rotation-y={rotY}
          >
            <planeGeometry args={[tamanho[0], tamanho[1]]} />
            <meshStandardMaterial map={qb.texture} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}
