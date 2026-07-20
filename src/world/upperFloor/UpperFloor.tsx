/**
 * UpperFloor.tsx — PAVIMENTOS SUPERIORES COMPLETOS (andares 1–3):
 * lajes y=3/6/9 dos blocos A/B/C (a do C com os furos da escada C),
 * acabamento de piso por ambiente, paredes/janelas/guarda-corpos dos 3
 * blocos, salas de aula superiores (A: sala-5…16; B: sala-17…24; C:
 * sala-27…32), auditório/laboratório/artes (1º andar do B), escadarias
 * (3 lances + patamares + passarelas) e telhado y=12.
 *
 * Ponto de montagem: <UpperFloor /> dentro do <Canvas> (sem props).
 * Escopo exclusivo deste agente: tudo o que está ACIMA das lajes
 * intermediárias (o térreo e a área externa ficam com outros agentes).
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CONST, SALAS } from '../../contracts/layout';
import { PALETTE } from '../../contracts/palette';
import type { RectXZ, Vec3 } from '../../contracts/types';
import { InstancedBoxes, type ItemCaixa } from './props/InstancedBoxes';
import { texturaPisoQuadriculado } from './props/textures';
import { paredesSuperiores } from './props/upperWalls';
import { Classrooms } from './Classrooms';
import { Auditorium } from './Auditorium';
import { Labs } from './Labs';
import { Staircase } from './Staircase';
import { Roof } from './Roof';

/** Cotas do topo das lajes intermediárias (piso dos andares 1–3). */
const YS_LAJES = [3, 6, 9];

// ---------------------------------------------------------------------------
// Recorte de furo retangular num rect (para os vãos da escada C nas lajes)
// ---------------------------------------------------------------------------

/** Furo da escada C na laje de cota y (ver SPANS do Bloco C em layout.ts):
 *  y=3 e y=9: vão sobre os lances 1/3 (x −45…−43); y=6: vão do lance 2 (x −43…−41). */
function furoEscadaC(y: number): RectXZ {
  return { x: y === 6 ? -43 : -45, z: -6, w: 2, d: 8 };
}

/** Devolve `r` fatiado em até 4 rects ao redor do furo `f` (f dentro de r). */
function cortarFuro(r: RectXZ, f: RectXZ): RectXZ[] {
  const out: RectXZ[] = [];
  const norte: RectXZ = { x: r.x, z: r.z, w: r.w, d: f.z - r.z };
  if (norte.d > 0.001) out.push(norte);
  const sul: RectXZ = { x: r.x, z: f.z + f.d, w: r.w, d: r.z + r.d - (f.z + f.d) };
  if (sul.d > 0.001) out.push(sul);
  const oeste: RectXZ = { x: r.x, z: f.z, w: f.x - r.x, d: f.d };
  if (oeste.w > 0.001) out.push(oeste);
  const leste: RectXZ = { x: f.x + f.w, z: f.z, w: r.x + r.w - (f.x + f.w), d: f.d };
  if (leste.w > 0.001) out.push(leste);
  return out;
}

// ---------------------------------------------------------------------------
// Lajes intermediárias (caixas de concreto) + acabamento de piso
// ---------------------------------------------------------------------------

/** Planta do Bloco C (x −45…−33, z −32…+20). */
const PLANTA_C: RectXZ = { x: -45, z: -32, w: 12, d: 52 };

/** Caixas das lajes: A (66×12) e B (62×10) inteiras; C fatiada pelo furo da escada. */
const LAJES: ItemCaixa[] = YS_LAJES.flatMap((y) => [
  { pos: [0, y - 0.125, -26], size: [66, 0.25, 12] as Vec3 }, // Bloco A
  { pos: [-2, y - 0.125, 15], size: [62, 0.25, 10] as Vec3 }, // Bloco B
  ...cortarFuro(PLANTA_C, furoEscadaC(y)).map((r) => ({
    pos: [r.x + r.w / 2, y - 0.125, r.z + r.d / 2] as Vec3,
    size: [r.w, 0.25, r.d] as Vec3,
  })),
]);

interface FaixaPiso {
  y: number;
  rect: RectXZ;
  corA: string;
  corB: string;
}

/** Faixas de piso quadriculado sobre as lajes (tons por ambiente), por pavimento. */
const FAIXAS_PISO: FaixaPiso[] = YS_LAJES.flatMap((y) => {
  const faixas: FaixaPiso[] = [
    // Bloco A — salas + hall leste (z −32…−23) e varanda (z −23…−20)
    { y, rect: { x: -33, z: -32, w: 66, d: 9 }, corA: PALETTE.pisoSala, corB: '#cdbd9a' },
    { y, rect: { x: -33, z: -23, w: 66, d: 3 }, corA: PALETTE.pisoCorredor, corB: '#b0a893' },
    // Bloco B — varanda (z +10…+13)
    { y, rect: { x: -33, z: 10, w: 62, d: 3 }, corA: PALETTE.pisoCorredor, corB: '#b0a893' },
    // Bloco C — salas de aula (x −45…−36, z −32…−16)
    { y, rect: { x: -45, z: -32, w: 9, d: 16 }, corA: PALETTE.pisoSala, corB: '#cdbd9a' },
    // Bloco C — corredor leste, trecho junto às salas (z −32…−16)
    { y, rect: { x: -36, z: -32, w: 3, d: 16 }, corA: PALETTE.pisoCorredor, corB: '#b0a893' },
  ];
  // Bloco B — cômodos (z +13…+20): 1º andar = auditório (madeira) + lab/artes;
  // 2º/3º andares = salas de aula.
  if (y === 3) {
    faixas.push(
      { y, rect: { x: -33, z: 13, w: 28, d: 7 }, corA: PALETTE.pisoAuditorio, corB: '#bd9260' },
      { y, rect: { x: -5, z: 13, w: 34, d: 7 }, corA: PALETTE.pisoSala, corB: '#cdbd9a' },
    );
  } else {
    faixas.push({ y, rect: { x: -33, z: 13, w: 62, d: 7 }, corA: PALETTE.pisoSala, corB: '#cdbd9a' });
  }
  // Bloco C — convivência + corredor a sul (x −45…−33, z −16…+20), fatiado
  // pelo furo da escada C.
  for (const r of cortarFuro({ x: -45, z: -16, w: 12, d: 36 }, furoEscadaC(y))) {
    faixas.push({ y, rect: r, corA: PALETTE.pisoCorredor, corB: '#b0a893' });
  }
  return faixas;
});

function LajesSuperiores() {
  // Uma textura-base por par de cores; cada faixa usa um CLONE com o repeat
  // do seu tamanho (imagem compartilhada — barato). Descartadas ao desmontar.
  const texturas = useMemo(() => {
    const bases = new Map<string, THREE.CanvasTexture>();
    const porFaixa = FAIXAS_PISO.map((f) => {
      const chave = `${f.corA}|${f.corB}`;
      let base = bases.get(chave);
      if (!base) {
        base = texturaPisoQuadriculado(f.corA, f.corB, 4, 4);
        bases.set(chave, base);
      }
      const t = base.clone();
      t.repeat.set(f.rect.w / 4, f.rect.d / 4);
      t.needsUpdate = true;
      return t;
    });
    return { bases: [...bases.values()], porFaixa };
  }, []);
  useEffect(
    () => () => {
      texturas.porFaixa.forEach((t) => t.dispose());
      texturas.bases.forEach((t) => t.dispose());
    },
    [texturas],
  );

  return (
    <group name="lajes-superiores">
      <InstancedBoxes items={LAJES} color={PALETTE.laje} roughness={0.95} castShadow receiveShadow />
      {FAIXAS_PISO.map((f, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[f.rect.x + f.rect.w / 2, f.y + 0.008, f.rect.z + f.rect.d / 2]}
          receiveShadow
        >
          <planeGeometry args={[f.rect.w, f.rect.d]} />
          <meshStandardMaterial map={texturas.porFaixa[i]} roughness={0.95} />
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
      fachadaC: porTipo('fachadaC'),
      interna: porTipo('interna'),
      guardaCorpo: porTipo('guardaCorpo'),
    };
  }, []);

  return (
    <group name="paredes-superiores">
      <InstancedBoxes items={grupos.fachadaA} color={PALETTE.paredeBlocoA} roughness={0.9} castShadow receiveShadow />
      <InstancedBoxes items={grupos.fachadaB} color={PALETTE.paredeBlocoB} roughness={0.9} castShadow receiveShadow />
      {/* Bloco C: a paleta não tem cor própria — reutiliza o creme da guarita. */}
      <InstancedBoxes items={grupos.fachadaC} color={PALETTE.guarita} roughness={0.9} castShadow receiveShadow />
      <InstancedBoxes items={grupos.interna} color={PALETTE.paredeInterna} roughness={0.95} castShadow receiveShadow />
      <InstancedBoxes items={grupos.guardaCorpo} color={PALETTE.guardaCorpo} roughness={0.7} castShadow receiveShadow />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Janelas dos andares 1–3 (SALAS[andar≥1].janelas): caixilho + vidro translúcido
// ---------------------------------------------------------------------------

function JanelasSuperiores() {
  const conjuntos = useMemo(() => {
    const vidros: ItemCaixa[] = [];
    const trilhosH: ItemCaixa[] = [];
    const trilhosV: ItemCaixa[] = [];
    const montantes: ItemCaixa[] = [];
    for (const sala of SALAS) {
      if (sala.andar < 1) continue; // térreo: outro agente
      const yBase = sala.andar * CONST.ALTURA_PISO;
      // Vão de janela padrão do contrato: 1,0 m a 2,2 m acima do piso do andar.
      const yDe = yBase + 1.0;
      const yAte = yBase + 2.2;
      const yC = (yDe + yAte) / 2;
      const altura = yAte - yDe;
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
// Componente raiz dos andares superiores
// ---------------------------------------------------------------------------

/**
 * Andares 1–3 completos: lajes, pisos, paredes, janelas, 26 salas de aula,
 * auditório, laboratório/artes, escadarias e telhado. Montar dentro do <Canvas>.
 */
export function UpperFloor() {
  return (
    <group name="andares-superiores">
      <LajesSuperiores />
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
