/**
 * PlayerRig.tsx — rig do jogador, vai DENTRO do <Canvas>.
 *
 * - modoCamera === 'andar' → <WalkControls/> (1ª pessoa com pointer lock);
 * - modoCamera === 'voar'  → <FlyControls/> (voo livre sem colisão, tecla F);
 * - modoCamera === 'aereo' → <OrbitControls/> REMAPEADO + <AereoBotoes/>:
 *   rodinha = zoom; botão do MEIO arrastado = orbitar; LMB/RMB segurados
 *   movem a câmera para frente/trás na direção da visão (ver abaixo).
 *   Botão direito NUNCA abre menu de contexto no canvas.
 * - Tab (global, com preventDefault) alterna andar ↔ aéreo — ou sai do voo —
 *   via toggleModoCamera; F (global) liga/desliga o voo via toggleVoo.
 * - Ao entrar no modo aéreo (inclusive no mount, se já começar aéreo), a
 *   câmera é posicionada para ver a escola inteira. Ao entrar no voo, a
 *   câmera continua de onde está (FlyControls lê posição/rotação no mount).
 */

import { useEffect, useRef } from 'react';
import { MOUSE, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useSchoolStore } from '../state/useSchoolStore';
import { WalkControls } from './WalkControls';
import { FlyControls } from './FlyControls';

/** Posição da câmera aérea (vê a escola toda) e alvo da órbita. */
const POS_AEREA: readonly [number, number, number] = [55, 45, 70];
const ALVO_AEREO: readonly [number, number, number] = [0, 2, -2];

/**
 * Botões remapeados do modo aéreo: só o MEIO orbita; esquerdo/direito ficam
 * sem ação nos OrbitControls (undefined) porque movem a câmera (AereoBotoes).
 * Em runtime os OrbitControls aceitam undefined (botão sem ação), mas o tipo
 * declara MOUSE — daí o cast.
 */
const BOTOES_AEREOS = {
  LEFT: undefined,
  MIDDLE: MOUSE.ROTATE,
  RIGHT: undefined,
} as unknown as { LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE };

/**
 * Fatia mínima dos OrbitControls usada pelo AereoBotoes. O fiber tipa
 * `controls` como EventDispatcher | null e three-stdlib está fora dos imports
 * permitidos, então usamos este recorte local (alvo da órbita).
 */
interface ControlesOrbitais {
  target: Vector3;
}

// Scratch do loop do AereoBotoes (instância única; sem alocação por frame).
const scratchDir = new Vector3();

/**
 * AereoBotoes — movimento por botões no modo aéreo: segurar LMB = câmera
 * avança na direção da visão; segurar RMB = recua. Move camera.position E
 * controls.target JUNTOS ao longo de (target − position), então o
 * enquadramento se preserva e o alvo nunca passa para trás da câmera.
 * Velocidade proporcional à distância ao alvo (clamp(dist × 0,8; 6; 80) m/s),
 * com a mesma suavização exponencial dos outros modos (k = 1 − exp(−10·dt)).
 * O alvo nunca desce abaixo de y = 0,5.
 */
function AereoBotoes() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  // makeDefault do OrbitControls publica a instância aqui; cast comentado acima.
  const controls = useThree((s) => s.controls) as unknown as ControlesOrbitais | null;

  const botoes = useRef<Set<number>>(new Set());
  const vel = useRef(0); // velocidade escalar atual ao longo da visão (m/s)

  useEffect(() => {
    const canvas = gl.domElement;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) botoes.current.add(e.button);
    };
    const onMouseUp = (e: MouseEvent) => {
      botoes.current.delete(e.button);
    };
    const onMouseLeave = () => botoes.current.clear();
    const onBlur = () => botoes.current.clear();
    // Botão direito nunca abre menu de contexto no canvas.
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
      botoes.current.clear();
    };
  }, [gl]);

  useFrame((_, dtBruto) => {
    if (useSchoolStore.getState().modoCamera !== 'aereo') return;
    if (!controls) return;
    const dt = Math.min(dtBruto, 0.05); // evita saltos ao trocar de aba

    let iz = 0;
    if (botoes.current.has(0)) iz += 1;
    if (botoes.current.has(2)) iz -= 1;

    // Direção da visão = do olho para o alvo da órbita.
    const alvo = controls.target;
    const dir = scratchDir.subVectors(alvo, camera.position);
    const dist = dir.length();
    if (dist < 1e-4) {
      vel.current = 0;
      return;
    }
    dir.multiplyScalar(1 / dist);

    // Perto = devagar, longe = rápido (escala com a distância ao alvo).
    const velMax = Math.max(6, Math.min(80, dist * 0.8));
    const k = 1 - Math.exp(-10 * dt);
    vel.current += (iz * velMax - vel.current) * k;
    if (iz === 0 && Math.abs(vel.current) < 0.02) {
      vel.current = 0;
      return;
    }

    let d = vel.current * dt;
    // O alvo não desce abaixo de 0,5 m: encurta o passo para pousar em 0,5
    // (ou zera, se já estiver no limite e o movimento empurrar para baixo).
    if (dir.y !== 0 && alvo.y + dir.y * d < 0.5) {
      const dLim = (0.5 - alvo.y) / dir.y;
      d = Math.sign(dLim) === Math.sign(d) ? dLim : 0;
    }
    camera.position.addScaledVector(dir, d);
    alvo.addScaledVector(dir, d);
  });

  return null; // controle puro: nada é renderizado
}

export function PlayerRig() {
  const modo = useSchoolStore((s) => s.modoCamera);
  const camera = useThree((s) => s.camera);

  // Tab alterna modos / sai do voo; F liga/desliga o voo. Ambos globais.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault(); // não mover o foco
        useSchoolStore.getState().toggleModoCamera();
      } else if (e.code === 'KeyF') {
        useSchoolStore.getState().toggleVoo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Ao entrar no modo aéreo: enquadra a escola toda.
  useEffect(() => {
    if (modo !== 'aereo') return;
    camera.position.set(POS_AEREA[0], POS_AEREA[1], POS_AEREA[2]);
    camera.lookAt(ALVO_AEREO[0], ALVO_AEREO[1], ALVO_AEREO[2]);
  }, [modo, camera]);

  if (modo === 'andar') return <WalkControls />;
  if (modo === 'voar') return <FlyControls />;

  return (
    <>
      <OrbitControls
        makeDefault
        target={[ALVO_AEREO[0], ALVO_AEREO[1], ALVO_AEREO[2]]}
        minDistance={8}
        maxDistance={170}
        maxPolarAngle={Math.PI / 2.15}
        enableDamping
        mouseButtons={BOTOES_AEREOS}
      />
      <AereoBotoes />
    </>
  );
}
