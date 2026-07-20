/**
 * Classrooms.tsx — Salas de aula dos PAVIMENTOS SUPERIORES (andares 1–3):
 * Bloco A (sala-5…sala-16), Bloco B (sala-17…sala-24, 2º/3º andares) e
 * Bloco C (sala-27…sala-32) — 26 salas, 20 carteiras cada (520 lugares).
 *
 * Mesmo padrão do térreo, ancorado nos contratos e ORIENTADO pelo quadro:
 * - CARTEIRAS[salaId]: 20 lugares/sala (grade 5×4) — partes instanciadas.
 *   A orientação de cada carteira vem de QUADROS[salaId].normal: o aluno
 *   olha para o quadro (−normal); o conjunto local (tampo à frente, encosto
 *   atrás) é girado pelo rotY da normal — cobre quadro NORTE (A), SUL (B)
 *   e OESTE (C) sem hardcode de geometria;
 * - QUADROS[salaId]: QUADRO BRANCO — moldura/bandeja de alumínio
 *   instanciadas, marcadores e apagadores instanciados, e a superfície
 *   escrita/revelada por <QuadrosBrancos> (sem lousa verde);
 * - MESAS_PROFESSOR[salaId]: mesa do professor junto ao quadro;
 * - armário no canto da parede da porta (deduzido de sala.portas[0]);
 * - 3 cartazes educativos (CanvasTexture); ventilador de teto girando.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  CARTEIRAS,
  CONST,
  IDS_SALAS_AULA,
  MESAS_PROFESSOR,
  QUADROS,
  getSala,
} from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { SalaDef, Vec3 } from '../../contracts/types';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';
import { texturaCartaz } from './props/textures';
import { QuadrosBrancos } from '../QuadrosBrancos';
import { COR_MARCADOR } from '../quadroBranco';

/** Ids das salas de aula dos andares 1–3 (sala-5…16, sala-17…24, sala-27…32). */
const SALAS_SUPERIORES = IDS_SALAS_AULA.filter((id) => getSala(id).andar >= 1);

/** Cinza-claro de alumínio escovado (cor local — contracts/palette intactos). */
const COR_ALUMINIO = '#c9ced4';

/** Cores dos 3 marcadores por sala, na ordem em que ficam na bandeja. */
const CORES_MARCADORES = [COR_MARCADOR.preto, COR_MARCADOR.azul, COR_MARCADOR.vermelho];

/**
 * Aplica um giro yaw (rotação em Y) a um offset local (ox, oz) — mesma
 * convenção do three.js: x' = x·cos + z·sen, z' = −x·sen + z·cos.
 */
function girar(ox: number, oz: number, rotY: number): [number, number] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [ox * c + oz * s, -ox * s + oz * c];
}

/** rotY que alinha o +Z local à normal do quadro (quadro N/S/O). */
function rotYPelaNormal(normal: Vec3): number {
  return Math.atan2(normal[0], normal[2]);
}

/**
 * Posição/orientação do armário: encostado na parede DA PORTA, no canto mais
 * distante da porta, 0,335 m para dentro da sala (faces da porta em +Z local).
 */
function armarioDa(sala: SalaDef): { centro: Vec3; rotY: number } {
  const p = sala.portas[0];
  const r = sala.rect;
  const y = sala.andar * CONST.ALTURA_PISO;
  if (p.eixo === 'x') {
    // Parede da porta ao longo de X: norte (z mínimo do rect) ou sul (z máximo).
    const noNorte = Math.abs(p.z - r.z) < 0.2;
    const dirZ = noNorte ? 1 : -1; // para dentro da sala
    const zParede = noNorte ? r.z : r.z + r.d;
    const noOeste = p.x - r.x > r.w / 2;
    const xCanto = noOeste ? r.x + 0.7 : r.x + r.w - 0.7;
    return { centro: [xCanto, y, zParede + dirZ * 0.335], rotY: Math.atan2(0, dirZ) };
  }
  // Parede da porta ao longo de Z: oeste (x mínimo) ou leste (x máximo).
  const noOeste = Math.abs(p.x - r.x) < 0.2;
  const dirX = noOeste ? 1 : -1;
  const xParede = noOeste ? r.x : r.x + r.w;
  const noNorte = p.z - r.z > r.d / 2;
  const zCanto = noNorte ? r.z + 0.7 : r.z + r.d - 0.7;
  return { centro: [xParede + dirX * 0.335, y, zCanto], rotY: Math.atan2(dirX, 0) };
}

// ---------------------------------------------------------------------------
// Mobiliário instanciado (todas as 26 salas em poucos draw calls)
// ---------------------------------------------------------------------------

function MobiliarioSalas() {
  const conjuntos = useMemo(() => {
    const tampos: ItemCaixa[] = [];
    const assentos: ItemCaixa[] = [];
    const encostos: ItemCaixa[] = [];
    const estrutura: ItemCaixa[] = [];
    const molduras: ItemCaixa[] = [];
    const bandejas: ItemCaixa[] = [];
    const marcadores: ItemCaixa[] = [];
    const apagadores: ItemCaixa[] = [];
    const feltros: ItemCaixa[] = [];
    const mesaProf: ItemCaixa[] = [];
    const carcacas: ItemCaixa[] = [];
    const portasArmario: ItemCaixa[] = [];
    const puxadores: ItemCaixa[] = [];

    /** Empurra uma caixa orientada: âncora + offset local girado + rotY. */
    const empurrar = (
      lista: ItemCaixa[],
      ancora: Vec3,
      ox: number,
      oy: number,
      oz: number,
      size: Vec3,
      rotY: number,
      color?: string,
    ) => {
      const [gx, gz] = girar(ox, oz, rotY);
      lista.push({
        pos: [ancora[0] + gx, ancora[1] + oy, ancora[2] + gz],
        size,
        rot: [0, rotY, 0],
        ...(color !== undefined ? { color } : {}),
      });
    };

    for (const salaId of SALAS_SUPERIORES) {
      const q = QUADROS[salaId];
      const rotQ = rotYPelaNormal(q.normal);
      // Offsets do quadro são relativos a q.pos (1,6 m acima do piso).

      // --- Carteiras (frame local: quadro em −Z; aluno olha para −Z).
      for (const [x, y, z] of CARTEIRAS[salaId]) {
        const assento: Vec3 = [x, y, z];
        empurrar(tampos, assento, 0, 0.72, -0.42, [0.6, 0.05, 0.45], rotQ);
        empurrar(assentos, assento, 0, 0.435, 0, [0.42, 0.05, 0.42], rotQ);
        empurrar(encostos, assento, 0, 0.7, 0.21, [0.42, 0.4, 0.05], rotQ);
        for (const s of [-1, 1]) {
          empurrar(estrutura, assento, s * 0.26, 0.36, -0.42, [0.05, 0.72, 0.45], rotQ);
        }
        empurrar(estrutura, assento, 0, 0.21, 0, [0.07, 0.42, 0.07], rotQ);
      }

      // --- Quadro branco: moldura e bandeja de ALUMÍNIO + 3 marcadores
      //     (cores por item) e apagador. A SUPERFÍCIE escrita/revelada vem de
      //     <QuadrosBrancos> — não há mais lousa verde instanciada.
      empurrar(molduras, q.pos, 0, 0, -0.015, [3.4, 1.5, 0.05], rotQ);
      empurrar(bandejas, q.pos, 0, -0.67, 0.06, [1.4, 0.05, 0.1], rotQ);
      for (let i = 0; i < 3; i++) {
        empurrar(marcadores, q.pos, -0.32 + i * 0.2, -0.633, 0.06, [0.17, 0.024, 0.024], rotQ, CORES_MARCADORES[i]);
      }
      empurrar(apagadores, q.pos, 0.42, -0.618, 0.06, [0.15, 0.03, 0.055], rotQ);
      empurrar(feltros, q.pos, 0.42, -0.639, 0.06, [0.15, 0.012, 0.055], rotQ);

      // --- Mesa do professor (tampo + 2 painéis laterais), de frente p/ a sala.
      const m = MESAS_PROFESSOR[salaId];
      empurrar(mesaProf, m, 0, 0.735, 0, [1.2, 0.06, 0.6], rotQ);
      for (const s of [-1, 1]) {
        empurrar(mesaProf, m, s * 0.55, 0.36, 0, [0.06, 0.72, 0.55], rotQ);
      }

      // --- Armário no canto da parede da porta, portas voltadas à sala.
      const arm = armarioDa(getSala(salaId));
      empurrar(carcacas, arm.centro, 0, 0.9, 0, [0.9, 1.8, 0.45], arm.rotY);
      for (const s of [-1, 1]) {
        empurrar(portasArmario, arm.centro, s * 0.225, 0.9, 0.24, [0.42, 1.68, 0.03], arm.rotY);
        empurrar(puxadores, arm.centro, s * 0.11, 0.9, 0.265, [0.035, 0.14, 0.03], arm.rotY);
      }
    }
    return {
      tampos, assentos, encostos, estrutura, molduras, bandejas,
      marcadores, apagadores, feltros, mesaProf, carcacas, portasArmario, puxadores,
    };
  }, []);

  return (
    <group name="mobiliario-salas-superiores">
      {/* 520 carteiras (20 × 26 salas) em 4 draw calls */}
      <InstancedBoxes items={conjuntos.tampos} color={PALETTE.carteira} roughness={0.8} castShadow receiveShadow />
      <InstancedBoxes items={conjuntos.assentos} color={PALETTE.carteira} roughness={0.8} castShadow receiveShadow />
      <InstancedBoxes items={conjuntos.encostos} color={PALETTE.carteira} roughness={0.8} receiveShadow />
      <InstancedBoxes items={conjuntos.estrutura} color={PALETTE.carteiraMetal} metalness={0.5} roughness={0.45} receiveShadow />
      {/* Quadros brancos: moldura/bandeja de alumínio + marcadores (cor por
          item, base branca) e apagadores instanciados; as SUPERFÍCIES
          texturizadas com a aula sendo escrita vêm do <QuadrosBrancos> */}
      <InstancedBoxes items={conjuntos.molduras} color={COR_ALUMINIO} metalness={0.6} roughness={0.4} receiveShadow />
      <InstancedBoxes items={conjuntos.bandejas} color={COR_ALUMINIO} metalness={0.6} roughness={0.4} />
      <InstancedBoxes items={conjuntos.marcadores} color={'#ffffff'} roughness={0.5} />
      <InstancedBoxes items={conjuntos.apagadores} color={'#9aa0a8'} roughness={0.8} />
      <InstancedBoxes items={conjuntos.feltros} color={'#3a3f47'} roughness={0.9} />
      {/* 3,2 × 1,3 na âncora, +0,015 ao longo da normal (mesma cota da antiga lousa) */}
      <QuadrosBrancos salaIds={SALAS_SUPERIORES} tamanho={[3.2, 1.3]} offsetZ={0.015} />
      {/* Mesas do professor */}
      <InstancedBoxes items={conjuntos.mesaProf} color={PALETTE.mesaProfessor} roughness={0.8} castShadow receiveShadow />
      {/* Armários */}
      <InstancedBoxes items={conjuntos.carcacas} color={PALETTE.estanteLivros} roughness={0.8} castShadow receiveShadow />
      <InstancedBoxes items={conjuntos.portasArmario} color={PALETTE.portaMadeira} roughness={0.8} receiveShadow />
      <InstancedBoxes items={conjuntos.puxadores} color={PALETTE.carteiraMetal} metalness={0.6} roughness={0.4} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cartazes educativos (CanvasTexture procedural; 4 desenhos ciclando por sala)
// ---------------------------------------------------------------------------

function Cartazes() {
  const texturas = useMemo(() => [0, 1, 2, 3].map((v) => texturaCartaz(v)), []);
  useEffect(() => () => texturas.forEach((t) => t.dispose()), [texturas]);

  const cartazes = useMemo(() => {
    const lista: { pos: Vec3; rotY: number; variante: number }[] = [];
    SALAS_SUPERIORES.forEach((salaId, i) => {
      const sala = getSala(salaId);
      const { x, z, w, d } = sala.rect;
      const y = sala.andar * CONST.ALTURA_PISO + 1.65;
      const quadroEmZ = QUADROS[salaId].normal[2] !== 0;
      if (quadroEmZ) {
        // Quadro NORTE (A) ou SUL (B): cartazes nas divisórias oeste/leste.
        lista.push({ pos: [x + 0.115, y, z + 3.4], rotY: Math.PI / 2, variante: i % 4 });
        lista.push({ pos: [x + 0.115, y, z + 5.6], rotY: Math.PI / 2, variante: (i + 1) % 4 });
        lista.push({ pos: [x + w - 0.115, y, z + d / 2], rotY: -Math.PI / 2, variante: (i + 2) % 4 });
      } else {
        // Quadro OESTE (C): 2 cartazes na parede leste + 1 na divisória z=−24
        // (face da sala — norte para a sala do norte, sul para a do sul).
        lista.push({ pos: [x + w - 0.115, y, z + 2.5], rotY: -Math.PI / 2, variante: i % 4 });
        lista.push({ pos: [x + w - 0.115, y, z + 5.5], rotY: -Math.PI / 2, variante: (i + 1) % 4 });
        const salaDoNorte = Math.abs(z + d + 24) < 0.01;
        lista.push(
          salaDoNorte
            ? { pos: [x + w / 2, y, z + d - 0.115], rotY: Math.PI, variante: (i + 2) % 4 }
            : { pos: [x + w / 2, y, z + 0.115], rotY: 0, variante: (i + 2) % 4 },
        );
      }
    });
    return lista;
  }, []);

  return (
    <group name="cartazes-salas-superiores">
      {cartazes.map((c, i) => (
        <mesh key={i} position={c.pos} rotation={[0, c.rotY, 0]}>
          <planeGeometry args={[0.95, 1.25]} />
          <meshStandardMaterial map={texturas[c.variante]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ventiladores de teto (3 pás, rotação contínua via useFrame — 1 por sala)
// ---------------------------------------------------------------------------

function Ventiladores() {
  const rotores = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, delta) => {
    for (const g of rotores.current) {
      if (g) g.rotation.y += delta * 10;
    }
  });

  return (
    <group name="ventiladores-superiores">
      {SALAS_SUPERIORES.map((salaId, i) => {
        const sala = getSala(salaId);
        const cx = sala.rect.x + sala.rect.w / 2;
        const cz = sala.rect.z + sala.rect.d / 2;
        const y = sala.andar * CONST.ALTURA_PISO;
        return (
          <group key={salaId} position={[cx, y, cz]}>
            {/* Haste até a laje/teto (teto em y+2,75…3) */}
            <mesh position={[0, 2.55, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
              <meshStandardMaterial color="#d9d9d9" metalness={0.4} roughness={0.5} />
            </mesh>
            {/* Motor */}
            <mesh position={[0, 2.28, 0]}>
              <cylinderGeometry args={[0.1, 0.12, 0.14, 12]} />
              <meshStandardMaterial color={PALETTE.janelaMoldura} metalness={0.3} roughness={0.5} />
            </mesh>
            {/* Rotor com 3 pás (fase inicial dessincronizada por sala) */}
            <group
              ref={(g) => {
                rotores.current[i] = g;
              }}
              position={[0, 2.2, 0]}
              rotation={[0, i * 1.1, 0]}
            >
              {[0, 1, 2].map((k) => (
                <mesh key={k} rotation={[0, (k * Math.PI * 2) / 3, 0]}>
                  <mesh position={[0.48, 0, 0]}>
                    <boxGeometry args={[0.85, 0.02, 0.15]} />
                    <meshStandardMaterial color={PALETTE.janelaMoldura} roughness={0.6} />
                  </mesh>
                </mesh>
              ))}
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------------------

/** Salas de aula superiores completas (mobiliário + cartazes + ventiladores). */
export function Classrooms() {
  return (
    <group name="salas-superiores">
      <MobiliarioSalas />
      <Cartazes />
      <Ventiladores />
    </group>
  );
}
