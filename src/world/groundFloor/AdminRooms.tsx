/**
 * AdminRooms.tsx — Cômodos administrativos do térreo do Bloco B:
 * Diretoria, Secretaria e Sala dos Professores (âncoras de ADMIN).
 *
 * Convenção de fachada: portas/janelas na parede norte (z=+13); as salas
 * se estendem até a parede sul (z=+20, fachada da rua).
 */

import * as THREE from 'three';
import { ADMIN } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import { Armario, Cadeira, Caixa, Computador, Mesa } from './props/furniture';
import { texturaBandeira, texturaDiploma, texturaQuadroAvisos } from './props/canvasTextures';

const MAT_DIPLOMA = new THREE.MeshStandardMaterial({ map: texturaDiploma(), roughness: 0.9 });
const MAT_AVISOS = new THREE.MeshStandardMaterial({ map: texturaQuadroAvisos(), roughness: 0.95 });
const MAT_BANDEIRA = new THREE.MeshStandardMaterial({
  map: texturaBandeira(),
  roughness: 0.9,
  side: THREE.DoubleSide,
});

// ---------------------------------------------------------------------------
// Diretoria (x 5…13, z 13…20)
// ---------------------------------------------------------------------------

function Diretoria() {
  const mesa = ADMIN.diretoriaMesa; // [9, 0, 17.5]
  return (
    <group name="diretoria">
      {/* Mesa da diretora com computador */}
      <Mesa pos={mesa} w={1.8} d={0.9} h={0.76} />
      <Computador pos={[mesa[0] - 0.3, 0.76, mesa[2] + 0.1]} rotY={0} />
      {/* Cadeira da diretora (lado sul da mesa, olhando para −Z) */}
      <Cadeira pos={[mesa[0], 0, mesa[2] + 0.75]} rotY={Math.PI} />
      {/* 2 cadeiras de visita (lado norte, olhando para a mesa, +Z) */}
      <Cadeira pos={[mesa[0] - 0.55, 0, mesa[2] - 0.85]} rotY={0} />
      <Cadeira pos={[mesa[0] + 0.55, 0, mesa[2] - 0.85]} rotY={0} />
      {/* Diploma emoldurado na parede sul */}
      <group position={[7, 1.8, 19.89]} rotation-y={Math.PI}>
        <Caixa pos={[0, 0, -0.01]} size={[0.86, 0.66, 0.03]} cor={PALETTE.portaMadeira} />
        <mesh position={[0, 0, 0.01]} material={MAT_DIPLOMA}>
          <planeGeometry args={[0.76, 0.56]} />
        </mesh>
      </group>
      {/* Bandeira do Brasil de pé (canto sudeste) */}
      <group position={[12.2, 0, 19.2]}>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.16, 0.2, 0.06, 12]} />
          <meshStandardMaterial color={PALETTE.carteiraMetal} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 2.4, 8]} />
          <meshStandardMaterial color={PALETTE.mastro} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.5, 1.95, 0]} material={MAT_BANDEIRA}>
          <planeGeometry args={[0.95, 0.66]} />
        </mesh>
      </group>
      {/* Armário */}
      <Armario pos={[5.6, 0, 19.6]} rotY={Math.PI} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Secretaria (x −3…5, z 13…20)
// ---------------------------------------------------------------------------

function Secretaria() {
  const balcao = ADMIN.secretariaMesa; // [1, 0, 16]
  return (
    <group name="secretaria">
      {/* Balcão/mesa de atendimento */}
      <Caixa pos={[balcao[0], 0.5, balcao[2]]} size={[2.4, 1.0, 0.6]} cor={PALETTE.balcaoCantina} castShadow receiveShadow />
      <Caixa pos={[balcao[0], 1.03, balcao[2]]} size={[2.6, 0.05, 0.75]} cor={PALETTE.mesaProfessor} />
      {/* Computador do secretário */}
      <Computador pos={[balcao[0] - 0.5, 1.055, balcao[2] + 0.05]} rotY={0} />
      {/* Cadeira de trabalho */}
      <Cadeira pos={[balcao[0], 0, balcao[2] + 0.75]} rotY={Math.PI} />
      {/* Armários contra a parede sul */}
      <Armario pos={[0, 0, 19.6]} rotY={Math.PI} />
      <Armario pos={[1.2, 0, 19.6]} rotY={Math.PI} />
      {/* Cadeiras de espera junto ao guichê (janela em x=3,4, z=13) */}
      <Cadeira pos={[3.2, 0, 14.4]} rotY={Math.PI} />
      <Cadeira pos={[4.1, 0, 14.4]} rotY={Math.PI} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sala dos Professores (x 13…21, z 13…20)
// ---------------------------------------------------------------------------

function SalaProfessores() {
  return (
    <group name="sala-dos-professores">
      {/* 4 mesas com 2 cadeiras cada (âncoras ADMIN.profMesas) */}
      {ADMIN.profMesas.map((p, i) => (
        <group key={i}>
          <Mesa pos={p} w={1.4} d={0.9} h={0.75} cor={PALETTE.mesaProfessor} />
          <Cadeira pos={[p[0], 0, p[2] - 0.75]} rotY={0} />
          <Cadeira pos={[p[0], 0, p[2] + 0.75]} rotY={Math.PI} />
        </group>
      ))}
      {/* Quadro de avisos na parede sul */}
      <group position={[17, 1.7, 19.89]} rotation-y={Math.PI}>
        <Caixa pos={[0, 0, -0.015]} size={[1.75, 1.25, 0.04]} cor={PALETTE.portaMadeira} />
        <mesh position={[0, 0, 0.01]} material={MAT_AVISOS}>
          <planeGeometry args={[1.6, 1.1]} />
        </mesh>
      </group>
      {/* Armário junto à parede norte */}
      <Armario pos={[20.4, 0, 13.4]} rotY={0} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Componente público
// ---------------------------------------------------------------------------

/** Diretoria, Secretaria e Sala dos Professores mobiliadas. */
export function AdminRooms() {
  return (
    <group name="admin-terreo">
      <Diretoria />
      <Secretaria />
      <SalaProfessores />
    </group>
  );
}
