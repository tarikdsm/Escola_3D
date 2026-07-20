/**
 * Auditorium.tsx — Auditório (1º andar do Bloco B, x −33…−5, z 13…20, y base 3).
 *
 * - Palco elevado (~0,45 m) no rect AUDITORIO.palco, com degrau frontal;
 * - Cortina teatral vermelha com dobras senoidais (PlaneGeometry deslocada),
 *   cobrindo a frente do palco com abertura parcial no meio + bandô superior;
 * - 54 cadeiras (AUDITORIO.cadeiras, 3 fileiras × 18) instanciadas, de frente
 *   para o palco;
 * - 2 holofotes FAKE: cone emissivo translúcido (feixe de luz), sem luz real.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { AUDITORIO } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { Vec3 } from '../../contracts/types';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';

const Y = 3;
/** Altura do tablado do palco (missão ~0,5 m; comentário do contrato 0,4 m). */
const H_PALCO = 0.45;
/** Cota z da cortina: logo atrás da face frontal do palco. */
const Z_CORTINA = 17.65;
/** Abertura central entre as duas pernas da cortina. */
const ABERTURA = { de: -18.4, ate: -15.6 };

/**
 * Plano vertical com dobras senoidais no eixo Z (cortina franzida).
 * `dobras` = número de ondas completas ao longo da largura.
 */
function geometriaCortina(largura: number, altura: number, dobras: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(largura, altura, Math.max(8, Math.round(largura * 5)), 1);
  const attr = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < attr.count; i++) {
    const x = attr.getX(i);
    attr.setZ(i, Math.sin((x / largura) * Math.PI * 2 * dobras) * 0.13);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Palco + degrau + cortina + varão
// ---------------------------------------------------------------------------

function Palco() {
  const { palco } = AUDITORIO;
  const cx = palco.x + palco.w / 2;
  const cz = palco.z + palco.d / 2;

  // Geometrias onduladas (2 pernas + bandô), descartadas ao desmontar.
  const geoEsq = useMemo(() => geometriaCortina(ABERTURA.de - palco.x, 2.15, 6), [palco.x]);
  const geoDir = useMemo(
    () => geometriaCortina(palco.x + palco.w - ABERTURA.ate, 2.15, 6),
    [palco.x, palco.w],
  );
  const geoBando = useMemo(() => geometriaCortina(palco.w + 0.2, 0.55, 12), [palco.w]);
  useEffect(
    () => () => {
      geoEsq.dispose();
      geoDir.dispose();
      geoBando.dispose();
    },
    [geoEsq, geoDir, geoBando],
  );

  const yBaseCortina = Y + H_PALCO; // barra da cortina repousa no tablado
  return (
    <group name="palco-auditorio">
      {/* Tablado */}
      <mesh position={[cx, Y + H_PALCO / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[palco.w, H_PALCO, palco.d]} />
        <meshStandardMaterial color={PALETTE.palco} roughness={0.75} />
      </mesh>
      {/* Degrau frontal (meia altura) */}
      <mesh position={[cx, Y + H_PALCO / 4, palco.z - 0.175]} castShadow receiveShadow>
        <boxGeometry args={[palco.w, H_PALCO / 2, 0.35]} />
        <meshStandardMaterial color={PALETTE.palco} roughness={0.75} />
      </mesh>
      {/* Pernas da cortina (abertura parcial no meio) */}
      <mesh
        geometry={geoEsq}
        position={[(palco.x + ABERTURA.de) / 2, yBaseCortina + 1.075, Z_CORTINA]}
      >
        <meshStandardMaterial color={PALETTE.cortina} roughness={0.9} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh
        geometry={geoDir}
        position={[(ABERTURA.ate + palco.x + palco.w) / 2, yBaseCortina + 1.075, Z_CORTINA]}
      >
        <meshStandardMaterial color={PALETTE.cortina} roughness={0.9} flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* Bandô (franzido curto sobre toda a boca do palco) */}
      <mesh geometry={geoBando} position={[cx, yBaseCortina + 1.98, Z_CORTINA - 0.05]}>
        <meshStandardMaterial color={PALETTE.cortina} roughness={0.9} flatShading side={THREE.DoubleSide} />
      </mesh>
      {/* Varão da cortina + terminais */}
      <mesh position={[cx, yBaseCortina + 2.21, Z_CORTINA]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, palco.w + 0.6, 10]} />
        <meshStandardMaterial color={PALETTE.portaMadeira} roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cx + s * (palco.w / 2 + 0.3), yBaseCortina + 2.21, Z_CORTINA]}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial color={PALETTE.portaMadeira} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Plateia: 54 cadeiras instanciadas, voltadas ao palco (+Z)
// ---------------------------------------------------------------------------

function Cadeiras() {
  const conjuntos = useMemo(() => {
    const assentos: ItemCaixa[] = [];
    const encostos: ItemCaixa[] = [];
    const pernas: ItemCaixa[] = [];
    for (const [x, , z] of AUDITORIO.cadeiras) {
      assentos.push({ pos: [x, Y + 0.45, z], size: [0.45, 0.06, 0.45] });
      encostos.push({ pos: [x, Y + 0.73, z - 0.2], size: [0.45, 0.48, 0.05] });
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          pernas.push({ pos: [x + sx * 0.19, Y + 0.215, z + sz * 0.19], size: [0.05, 0.43, 0.05] });
        }
      }
    }
    return { assentos, encostos, pernas };
  }, []);

  return (
    <group name="plateia-auditorio">
      <InstancedBoxes items={conjuntos.assentos} color={PALETTE.cadeira} roughness={0.7} castShadow receiveShadow />
      <InstancedBoxes items={conjuntos.encostos} color={PALETTE.cadeira} roughness={0.7} receiveShadow />
      <InstancedBoxes items={conjuntos.pernas} color={PALETTE.carteiraMetal} metalness={0.5} roughness={0.45} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Holofotes fake (cone emissivo translúcido; NENHUMA luz real é criada)
// ---------------------------------------------------------------------------

function Holofote({ origem, alvo }: { origem: Vec3; alvo: Vec3 }) {
  const d = useMemo(() => {
    const o = new THREE.Vector3(...origem);
    const t = new THREE.Vector3(...alvo);
    const dir = t.clone().sub(o);
    const dist = dir.length();
    const dirN = dir.clone().normalize();
    // ConeGeometry tem o ápice em +Y: alinhamos +Y à direção alvo→origem.
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      o.clone().sub(t).normalize(),
    );
    const comp = dist * 0.92;
    return {
      quat,
      comp,
      meio: o.clone().addScaledVector(dirN, comp / 2),
      lente: o.clone().addScaledVector(dirN, 0.19),
    };
  }, [origem, alvo]);

  return (
    <group>
      {/* Haste de fixação no teto */}
      <mesh position={[origem[0], 5.78, origem[2]]}>
        <cylinderGeometry args={[0.03, 0.03, 0.16, 8]} />
        <meshStandardMaterial color="#3d3d3d" roughness={0.6} />
      </mesh>
      {/* Corpo do canhão */}
      <mesh position={origem} quaternion={d.quat}>
        <cylinderGeometry args={[0.14, 0.17, 0.36, 12]} />
        <meshStandardMaterial color="#3d3d3d" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Lente acesa */}
      <mesh position={d.lente} quaternion={d.quat}>
        <cylinderGeometry args={[0.11, 0.11, 0.03, 12]} />
        <meshStandardMaterial color={PALETTE.sol} emissive={PALETTE.sol} emissiveIntensity={1.4} />
      </mesh>
      {/* Feixe fake: cone emissivo translúcido */}
      <mesh position={d.meio} quaternion={d.quat}>
        <coneGeometry args={[1.25, d.comp, 20, 1, true]} />
        <meshStandardMaterial
          color="#fff7d6"
          emissive="#ffe9a3"
          emissiveIntensity={0.8}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Auditório completo (palco, cortina, plateia e holofotes). */
export function Auditorium() {
  return (
    <group name="auditorio">
      <Palco />
      <Cadeiras />
      <Holofote origem={[-24, 5.7, 13.5]} alvo={[-20, Y + H_PALCO, 18.2]} />
      <Holofote origem={[-10, 5.7, 13.5]} alvo={[-14, Y + H_PALCO, 18.2]} />
    </group>
  );
}
