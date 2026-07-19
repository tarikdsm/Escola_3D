/**
 * UpperFloor.tsx — 1º ANDAR COMPLETO (laje y=3, paredes y 3…6, guarda-corpos,
 * janelas superiores) + escadarias + telhado.
 *
 * Ponto de montagem: <UpperFloor /> dentro do <Canvas> (sem props).
 * Escopo exclusivo deste agente: tudo o que está ACIMA da laje intermediária
 * nos blocos A e B (o térreo e a área externa ficam com outros agentes).
 */

import { useEffect, useMemo } from 'react';
import { SALAS } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { RectXZ } from '../../contracts/types';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';
import { texturaPisoQuadriculado } from './props/textures';
import { paredesSuperiores } from './props/upperWalls';
import { Classrooms } from './Classrooms';
import { Auditorium } from './Auditorium';
import { Labs } from './Labs';
import { Staircase } from './Staircase';
import { Roof } from './Roof';

/** Cota do topo da laje (piso do 1º andar). */
const Y_PISO = 3;

// ---------------------------------------------------------------------------
// Laje intermediária (piso do 1º andar / teto do térreo)
// ---------------------------------------------------------------------------

/** Faixas de piso quadriculado sobre a laje (tons por ambiente). */
const FAIXAS_PISO: { rect: RectXZ; corA: string; corB: string }[] = [
  // Bloco A — salas 7–12 (z −32…−23)
  { rect: { x: -33, z: -32, w: 66, d: 9 }, corA: PALETTE.pisoSala, corB: '#cdbd9a' },
  // Bloco A — varanda superior (z −23…−20)
  { rect: { x: -33, z: -23, w: 66, d: 3 }, corA: PALETTE.pisoCorredor, corB: '#b0a893' },
  // Bloco B — auditório (x −29…−5), piso de madeira clara
  { rect: { x: -29, z: 13, w: 24, d: 7 }, corA: PALETTE.pisoAuditorio, corB: '#bd9260' },
  // Bloco B — laboratório + artes (x −5…+29)
  { rect: { x: -5, z: 13, w: 34, d: 7 }, corA: PALETTE.pisoSala, corB: '#cdbd9a' },
  // Bloco B — varanda superior (z +10…+13)
  { rect: { x: -29, z: 10, w: 58, d: 3 }, corA: PALETTE.pisoCorredor, corB: '#b0a893' },
];

function LajeIntermediaria() {
  // Uma textura quadriculada por faixa de piso (descartadas ao desmontar).
  const texturas = useMemo(
    () => FAIXAS_PISO.map((f) => texturaPisoQuadriculado(f.corA, f.corB, f.rect.w, f.rect.d)),
    [],
  );
  useEffect(() => () => texturas.forEach((t) => t.dispose()), [texturas]);

  const lajes: ItemCaixa[] = [
    // Bloco A: x −33…+33, z −32…−20 (66 × 12), face superior em y=3.
    { pos: [0, Y_PISO - 0.125, -26], size: [66, 0.25, 12] },
    // Bloco B: x −29…+29, z +10…+20 (58 × 10), face superior em y=3.
    { pos: [0, Y_PISO - 0.125, 15], size: [58, 0.25, 10] },
  ];

  return (
    <group name="laje-intermediaria">
      <InstancedBoxes items={lajes} color={PALETTE.laje} roughness={0.95} castShadow receiveShadow />
      {FAIXAS_PISO.map((f, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[f.rect.x + f.rect.w / 2, Y_PISO + 0.008, f.rect.z + f.rect.d / 2]}
          receiveShadow
        >
          <planeGeometry args={[f.rect.w, f.rect.d]} />
          <meshStandardMaterial map={texturas[i]} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Paredes superiores + guarda-corpos (1 caixa instanciada por AABB de WALLS)
// ---------------------------------------------------------------------------

function ParedesSuperiores() {
  const grupos = useMemo(() => {
    const todos = paredesSuperiores();
    const porTipo = (tipo: string): ItemCaixa[] =>
      todos.filter((p) => p.tipo === tipo).map((p) => ({ pos: p.centro, size: p.tamanho }));
    return {
      fachadaA: porTipo('fachadaA'),
      fachadaB: porTipo('fachadaB'),
      interna: porTipo('interna'),
      guardaCorpo: porTipo('guardaCorpo'),
    };
  }, []);

  return (
    <group name="paredes-superiores">
      <InstancedBoxes items={grupos.fachadaA} color={PALETTE.paredeBlocoA} roughness={0.9} castShadow receiveShadow />
      <InstancedBoxes items={grupos.fachadaB} color={PALETTE.paredeBlocoB} roughness={0.9} castShadow receiveShadow />
      <InstancedBoxes items={grupos.interna} color={PALETTE.paredeInterna} roughness={0.95} castShadow receiveShadow />
      <InstancedBoxes items={grupos.guardaCorpo} color={PALETTE.guardaCorpo} roughness={0.7} castShadow receiveShadow />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Janelas do 1º andar (SALAS[andar=1].janelas): caixilho + vidro translúcido
// ---------------------------------------------------------------------------

function JanelasSuperiores() {
  const conjuntos = useMemo(() => {
    const vidros: ItemCaixa[] = [];
    const trilhosH: ItemCaixa[] = [];
    const trilhosV: ItemCaixa[] = [];
    const montantes: ItemCaixa[] = [];
    // Vão de janela padrão do contrato: 1,0 m a 2,2 m acima do piso do andar.
    const yDe = Y_PISO + 1.0;
    const yAte = Y_PISO + 2.2;
    const yC = (yDe + yAte) / 2;
    const altura = yAte - yDe;
    for (const sala of SALAS) {
      if (sala.andar !== 1) continue;
      for (const j of sala.janelas) {
        const rotY = j.eixo === 'x' ? 0 : Math.PI / 2;
        // Direção ao longo da parede (para posicionar os trilhos laterais).
        const dirX = j.eixo === 'x' ? 1 : 0;
        const dirZ = j.eixo === 'x' ? 0 : 1;
        vidros.push({
          pos: [j.x, yC, j.z],
          size: [j.largura - 0.04, altura - 0.04, 0.05],
          rot: [0, rotY, 0],
        });
        // Trilhos horizontais (peitoril e verga do caixilho).
        for (const y of [yDe + 0.02, yAte - 0.02]) {
          trilhosH.push({
            pos: [j.x, y, j.z],
            size: [j.largura + 0.12, 0.09, 0.26],
            rot: [0, rotY, 0],
          });
        }
        // Trilhos verticais nas bordas do vão.
        for (const s of [-1, 1]) {
          trilhosV.push({
            pos: [
              j.x + dirX * s * (j.largura / 2 - 0.045),
              yC,
              j.z + dirZ * s * (j.largura / 2 - 0.045),
            ],
            size: [0.09, altura + 0.06, 0.26],
            rot: [0, rotY, 0],
          });
        }
        // Montante central (divisória clássica de janela escolar).
        montantes.push({
          pos: [j.x, yC, j.z],
          size: [0.06, altura - 0.06, 0.12],
          rot: [0, rotY, 0],
        });
      }
    }
    return { vidros, trilhosH, trilhosV, montantes };
  }, []);

  return (
    <group name="janelas-superiores">
      <InstancedBoxes
        items={conjuntos.vidros}
        color={PALETTE.janelaVidro}
        roughness={0.15}
        transparent
        opacity={0.45}
        depthWrite={false}
        receiveShadow={false}
      />
      <InstancedBoxes items={conjuntos.trilhosH} color={PALETTE.janelaMoldura} roughness={0.6} />
      <InstancedBoxes items={conjuntos.trilhosV} color={PALETTE.janelaMoldura} roughness={0.6} />
      <InstancedBoxes items={conjuntos.montantes} color={PALETTE.janelaMoldura} roughness={0.6} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Componente raiz do andar superior
// ---------------------------------------------------------------------------

/**
 * 1º andar completo: laje, paredes, janelas, salas 7–12, auditório,
 * laboratório/artes, escadarias e telhado. Montar dentro do <Canvas>.
 */
export function UpperFloor() {
  return (
    <group name="andar-superior">
      <LajeIntermediaria />
      <ParedesSuperiores />
      <JanelasSuperiores />
      <Classrooms />
      <Auditorium />
      <Labs />
      <Staircase />
      <Roof />
    </group>
  );
}
