/**
 * Facade.tsx — Muros do terreno, guarita do porteiro, portão animado e
 * letreiro da fachada do Bloco B.
 *
 * Os AABBs dos muros/guarita vêm de WALLS (fonte única da verdade), filtrados
 * pela convenção de fatiamento: centro FORA dos dois blocos e espessura > 0,15
 * (o alambrado, espessura 0,1, é renderizado em SportsCourt como tela).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Instances, Instance } from '@react-three/drei';
import { PALETTE, WALLS, PORTARIA } from '../../contracts';
import type { AABB } from '../../contracts';
import { useSchoolStore } from '../../state/useSchoolStore';
import { texturaLetreiro } from './canvasTextures';

// ---------------------------------------------------------------------------
// Fatiamento dos WALLS (centro fora dos blocos A/B)
// ---------------------------------------------------------------------------

function dentroDosBlocos(cx: number, cz: number): boolean {
  const noA = cx >= -33 && cx <= 33 && cz >= -32 && cz <= -20;
  const noB = cx >= -29 && cx <= 29 && cz >= 10 && cz <= 20;
  return noA || noB;
}

interface Caixa {
  centro: [number, number, number];
  tamanho: [number, number, number];
}

function aabbParaCaixa(a: AABB): Caixa {
  return {
    centro: [
      (a.min[0] + a.max[0]) / 2,
      (a.min[1] + a.max[1]) / 2,
      (a.min[2] + a.max[2]) / 2,
    ],
    tamanho: [a.max[0] - a.min[0], a.max[1] - a.min[1], a.max[2] - a.min[2]],
  };
}

const EXTERNOS = WALLS.filter((a) => {
  const cx = (a.min[0] + a.max[0]) / 2;
  const cz = (a.min[2] + a.max[2]) / 2;
  if (dentroDosBlocos(cx, cz)) return false;
  const espessura = Math.min(a.max[0] - a.min[0], a.max[2] - a.min[2]);
  return espessura > 0.15; // exclui o alambrado (0,1)
});
/**
 * Separa pelo RETÂNGULO da guarita (x −16…−13, z 42…45): os fragmentos de
 * verga/peitoril da porta e da janela têm altura < 2,4 e seriam confundidos
 * com muro se o critério fosse só a altura.
 */
const NA_GUARITA = (a: AABB) => {
  const cx = (a.min[0] + a.max[0]) / 2;
  const cz = (a.min[2] + a.max[2]) / 2;
  return cx >= -16.2 && cx <= -12.8 && cz >= 41.8 && cz <= 45.2;
};
const GUARITA_WALLS = EXTERNOS.filter(NA_GUARITA).map(aabbParaCaixa);
const MUROS = EXTERNOS.filter((a) => !NA_GUARITA(a)).map(aabbParaCaixa);

// ---------------------------------------------------------------------------
// Muros (instanced) com faixa de cor na base
// ---------------------------------------------------------------------------

function Muros() {
  return (
    <group>
      <Instances limit={MUROS.length} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.muro} />
        {MUROS.map((c, i) => (
          <Instance key={i} position={c.centro} scale={c.tamanho} />
        ))}
      </Instances>
      {/* Faixa pintada na base dos muros (levemente mais larga). */}
      <Instances limit={MUROS.length}>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.faixaAzulejo} />
        {MUROS.map((c, i) => (
          <Instance
            key={i}
            position={[c.centro[0], 0.25, c.centro[2]]}
            scale={[c.tamanho[0] + 0.06, 0.5, c.tamanho[2] + 0.06]}
          />
        ))}
      </Instances>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Guarita do porteiro (paredes + telhadinho + janela + porta)
// ---------------------------------------------------------------------------

function Guarita() {
  const g = PORTARIA.guarita; // x −16, z 42, 3×3
  const cx = g.x + g.w / 2;
  const cz = g.z + g.d / 2;
  return (
    <group>
      <Instances limit={GUARITA_WALLS.length} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color={PALETTE.guarita} />
        {GUARITA_WALLS.map((c, i) => (
          <Instance key={i} position={c.centro} scale={c.tamanho} />
        ))}
      </Instances>
      {/* Telhadinho piramidal de 4 águas (simplificado). */}
      <mesh position={[cx, 3.0, cz]} rotation-y={Math.PI / 4} castShadow>
        <coneGeometry args={[2.5, 0.8, 4]} />
        <meshStandardMaterial color={PALETTE.telhadoB} flatShading />
      </mesh>
      {/* Janela voltada ao portão (face oeste, x=−16). */}
      <mesh position={[g.x - 0.02, 1.55, 43.7]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[1.1, 1.2]} />
        <meshStandardMaterial color={PALETTE.janelaMoldura} />
      </mesh>
      <mesh position={[g.x - 0.04, 1.55, 43.7]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.9, 1.0]} />
        <meshStandardMaterial color={PALETTE.janelaVidro} />
      </mesh>
      {/* Porta na face norte (z=42), voltada ao pátio. */}
      <mesh position={[-14.5, 1.05, g.z - 0.02]} rotation-y={Math.PI}>
        <planeGeometry args={[0.9, 2.1]} />
        <meshStandardMaterial color={PALETTE.portaMadeira} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Portão (dois painéis de grade metálica que abrem/fecham)
// ---------------------------------------------------------------------------

/** Barras verticais de um painel de 2 m (instanced). */
function BarrasPainel({ s }: { s: 1 | -1 }) {
  const barras = [0.35, 0.62, 0.89, 1.16, 1.43, 1.7];
  return (
    <Instances limit={barras.length}>
      <boxGeometry />
      <meshStandardMaterial color={PALETTE.portaoMetal} />
      {barras.map((x) => (
        <Instance key={x} position={[s * x, 1.06, 0]} scale={[0.05, 1.92, 0.05]} />
      ))}
    </Instances>
  );
}

/**
 * Um painel do portão. O grupo tem origem na DOBRADIÇA (x = −22 ou −18, z=45)
 * e o conteúdo se estende 2 m na direção do centro do vão. Aberto = gira ~97°
 * para dentro do terreno; a rotação é amortecida no useFrame.
 */
function PainelPortao({ lado, aberto }: { lado: 'esq' | 'dir'; aberto: boolean }) {
  const grupo = useRef<THREE.Group>(null);
  const s: 1 | -1 = lado === 'esq' ? 1 : -1;
  const alvo = aberto ? s * 1.7 : 0;
  useFrame((_, delta) => {
    if (!grupo.current) return;
    grupo.current.rotation.y = THREE.MathUtils.damp(
      grupo.current.rotation.y,
      alvo,
      3.5,
      delta,
    );
  });
  const xDobradica = lado === 'esq' ? -22 : -18;
  return (
    <group ref={grupo} position={[xDobradica, 0, 45]}>
      {/* Moldura do painel (2,0 × 2,1 m). */}
      <mesh position={[s * 1.0, 0.12, 0]} castShadow>
        <boxGeometry args={[1.95, 0.1, 0.06]} />
        <meshStandardMaterial color={PALETTE.portaoMetal} />
      </mesh>
      <mesh position={[s * 1.0, 2.02, 0]} castShadow>
        <boxGeometry args={[1.95, 0.1, 0.06]} />
        <meshStandardMaterial color={PALETTE.portaoMetal} />
      </mesh>
      <mesh position={[s * 1.0, 1.07, 0]}>
        <boxGeometry args={[1.95, 0.06, 0.05]} />
        <meshStandardMaterial color={PALETTE.portaoMetal} />
      </mesh>
      <mesh position={[s * 0.08, 1.07, 0]}>
        <boxGeometry args={[0.08, 2.0, 0.06]} />
        <meshStandardMaterial color={PALETTE.portaoMetal} />
      </mesh>
      <mesh position={[s * 1.93, 1.07, 0]}>
        <boxGeometry args={[0.08, 2.0, 0.06]} />
        <meshStandardMaterial color={PALETTE.portaoMetal} />
      </mesh>
      <BarrasPainel s={s} />
    </group>
  );
}

/** Portão completo: pilares das dobradiças + dois painéis animados. */
function Portao() {
  // Baixa frequência (só muda quando o porteiro abre/fecha): subscribe ok.
  const aberto = useSchoolStore((s) => s.portaoAberto);
  return (
    <group>
      {[-22, -18].map((x) => (
        <mesh key={x} position={[x, 1.1, 45]} castShadow>
          <boxGeometry args={[0.18, 2.2, 0.18]} />
          <meshStandardMaterial color={PALETTE.portaoMetal} />
        </mesh>
      ))}
      <PainelPortao lado="esq" aberto={aberto} />
      <PainelPortao lado="dir" aberto={aberto} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Letreiro da fachada sul do Bloco B (parede z=+20, virada à rua)
// ---------------------------------------------------------------------------

function Letreiro() {
  const tex = useMemo(() => texturaLetreiro(), []);
  return (
    <group position={[0, 4.5, 20]}>
      {/* Moldura clara atrás da placa. */}
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[10.4, 1.5, 0.1]} />
        <meshStandardMaterial color={PALETTE.janelaMoldura} />
      </mesh>
      {/* Placa com o nome da escola (CanvasTexture — sem <Text> do drei). */}
      <mesh position={[0, 0, 0.18]}>
        <planeGeometry args={[10, 1.25]} />
        <meshStandardMaterial map={tex} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Muros + guarita + portão + letreiro. */
export function Facade() {
  return (
    <group>
      <Muros />
      <Guarita />
      <Portao />
      <Letreiro />
    </group>
  );
}
