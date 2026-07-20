/**
 * VooControls.tsx — MODO VOO (padrão ao carregar), vai DENTRO do <Canvas>,
 * montado pelo PlayerRig apenas quando modoCam === 'voo'.
 *
 * Modelo mouse-first (sem teclado de movimento — ver contracts/store.ts):
 * - Mouse controla a DIREÇÃO da câmera em pointer lock; o lock só vem com
 *   gesto do usuário: sem lock o modo está ARMADO (câmera parada, cursor
 *   livre) e o clique no canvas pede a trava (chip do HUD avisa). ESC sai
 *   da trava (nativo do browser) → PlayerRig leva ao modo 'livre'.
 * - Botão ESQUERDO segurado = para frente; DIREITO segurado = para trás
 *   (na direção do olhar, yaw+pitch); SCROLL = zoom (dolly ao longo do
 *   olhar, ~8 m por notch). Botões só movem com o ponteiro travado.
 * - API touch (src/player/entrada.ts): girarVisao/zoomCam passam pela mesma
 *   fila do mouse; entradaMover move MESMO sem pointer lock (mobile não
 *   tem lock) — strafe do touch também só existe por aí (mouse não strafa).
 * - Voo SEM colisão e SEM chão (atravessa paredes/telhado), com clamp de
 *   segurança: x/z dentro de TERRENO ± 40; y entre 0,3 e 80.
 * - Convenção de escrita: playerState.pos = [x, y − 1,6, z] — no voo NÃO
 *   são pés reais (só para a simulação localizar o jogador).
 * - Não faz subscribe à store: lê modoCam via getState() no loop/listeners.
 */

import { useEffect, useRef } from 'react';
import { Euler } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { TERRENO } from '../contracts/layout';
import { playerState } from '../contracts/simBuffer';
import type { Vec3 } from '../contracts/types';
import { useSchoolStore } from '../state/useSchoolStore';
import { consumirGiro, consumirZoom, eixosTouch, girarVisao, zoomCam } from './entrada';
import { pedirTravaPointer } from './pointerLock';

const SENSIBILIDADE = 0.0023; // rad por pixel de mouse (mesma do modelo antigo)
const PITCH_MAX = (89 * Math.PI) / 180;
const VEL_VOO = 8; // m/s
const PASSO_ZOOM = 0.08; // m por unidade de delta (notch de ~100 → ~8 m)
const MARGEM_VOO = 40; // folga além do TERRENO em x/z
const Y_MIN = 0.3;
const Y_MAX = 80;
const ALTURA_OLHOS = 1.6; // só para a convenção de playerState.pos (ver acima)

// Scratch para ler a orientação atual da câmera no mount (sem alocar).
const scratchEuler = new Euler();

export function VooControls() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  // Botões do mouse segurados (0 = esquerdo → frente; 2 = direito → trás).
  const botoes = useRef<Set<number>>(new Set());
  // Posição da CÂMERA (olhos). O voo não tem pés nem chão.
  const pos = useRef<Vec3>([0, 0, 0]);
  const vel = useRef<Vec3>([0, 0, 0]);
  const yaw = useRef(0);
  const pitch = useRef(0);
  // Scratch do giro consumido por frame (sem alocação).
  const giro = useRef({ dx: 0, dy: 0 });

  // Estado inicial: a câmera continua de onde está (posição E orientação),
  // para a transição livre → voo ser contínua.
  useEffect(() => {
    pos.current[0] = camera.position.x;
    pos.current[1] = camera.position.y;
    pos.current[2] = camera.position.z;
    scratchEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = scratchEuler.y;
    pitch.current = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, scratchEuler.x));
    vel.current[0] = 0;
    vel.current[1] = 0;
    vel.current[2] = 0;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch.current, yaw.current, 0);
    // Drena resíduo das filas (ex.: API touch usada no modo 'livre').
    consumirGiro(giro.current);
    consumirZoom();
  }, [camera]);

  // Mouse: lock no clique, olhar (mousemove), botões frente/trás, zoom (wheel).
  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      if (useSchoolStore.getState().modoCam !== 'voo') return;
      pedirTravaPointer(canvas); // modo armado → 1º clique trava o ponteiro
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      girarVisao(e.movementX, e.movementY); // mesma fila da API touch
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) botoes.current.add(e.button);
    };
    const onMouseUp = (e: MouseEvent) => {
      botoes.current.delete(e.button);
    };
    const onMouseLeave = () => botoes.current.clear();
    const onBlur = () => botoes.current.clear();
    const onWheel = (e: WheelEvent) => {
      if (useSchoolStore.getState().modoCam !== 'voo') return;
      // Normaliza o modo linha (raro) para "pixels"; deltaY > 0 = afastar.
      zoomCam(-e.deltaY * (e.deltaMode === 1 ? 33 : 1));
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('blur', onBlur);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousemove', onMouseMove);
      botoes.current.clear();
      // Saiu do voo segurando botões: não deixar velocidade residual na volta.
      vel.current[0] = 0;
      vel.current[1] = 0;
      vel.current[2] = 0;
    };
  }, [gl]);

  useFrame((_, dtBruto) => {
    if (useSchoolStore.getState().modoCam !== 'voo') return;
    const dt = Math.min(dtBruto, 0.05); // evita saltos ao trocar de aba

    // --- Olhar (fila unificada mouse + touch) ---
    consumirGiro(giro.current);
    yaw.current -= giro.current.dx * SENSIBILIDADE;
    pitch.current = Math.max(
      -PITCH_MAX,
      Math.min(PITCH_MAX, pitch.current - giro.current.dy * SENSIBILIDADE),
    );

    // Frente = direção do olhar (yaw+pitch); strafe (só touch) no plano.
    const sinY = Math.sin(yaw.current);
    const cosY = Math.cos(yaw.current);
    const sinP = Math.sin(pitch.current);
    const cosP = Math.cos(pitch.current);
    const fx = -sinY * cosP;
    const fy = sinP;
    const fz = -cosY * cosP;
    const rx = cosY;
    const rz = -sinY;

    // --- Zoom (scroll/pinça): dolly imediato ao longo do olhar ---
    const p = pos.current;
    const zoom = consumirZoom();
    if (zoom !== 0) {
      const passo = zoom * PASSO_ZOOM;
      p[0] += fx * passo;
      p[1] += fy * passo;
      p[2] += fz * passo;
    }

    // --- Entrada de movimento: botões (só com lock) + eixos touch ---
    const travado = document.pointerLockElement === gl.domElement;
    let iz = eixosTouch.z;
    let ix = eixosTouch.x;
    if (travado) {
      if (botoes.current.has(0)) iz += 1;
      if (botoes.current.has(2)) iz -= 1;
    }
    if (iz > 1) iz = 1;
    else if (iz < -1) iz = -1;

    let alvoX = 0;
    let alvoY = 0;
    let alvoZ = 0;
    if (iz !== 0 || ix !== 0) {
      alvoX = fx * iz + rx * ix;
      alvoY = fy * iz;
      alvoZ = fz * iz + rz * ix;
      const comp = Math.hypot(alvoX, alvoY, alvoZ);
      if (comp > 1) {
        // Diagonais não ficam mais rápidas.
        const inv = 1 / comp;
        alvoX *= inv;
        alvoY *= inv;
        alvoZ *= inv;
      }
      alvoX *= VEL_VOO;
      alvoY *= VEL_VOO;
      alvoZ *= VEL_VOO;
    }

    // Aceleração suave (lerp exponencial em direção à velocidade-alvo).
    const k = 1 - Math.exp(-10 * dt);
    vel.current[0] += (alvoX - vel.current[0]) * k;
    vel.current[1] += (alvoY - vel.current[1]) * k;
    vel.current[2] += (alvoZ - vel.current[2]) * k;

    // --- Movimento livre, com clamp de segurança para não se perder ---
    p[0] = Math.max(TERRENO.minX - MARGEM_VOO, Math.min(TERRENO.maxX + MARGEM_VOO, p[0] + vel.current[0] * dt));
    p[1] = Math.max(Y_MIN, Math.min(Y_MAX, p[1] + vel.current[1] * dt));
    p[2] = Math.max(TERRENO.minZ - MARGEM_VOO, Math.min(TERRENO.maxZ + MARGEM_VOO, p[2] + vel.current[2] * dt));

    // --- Publica o estado e move a câmera ---
    // Convenção: pos = "pés" = olhos − 1,6. NO VOO NÃO SÃO PÉS REAIS —
    // serve só para a simulação saber onde o jogador está.
    playerState.pos[0] = p[0];
    playerState.pos[1] = p[1] - ALTURA_OLHOS;
    playerState.pos[2] = p[2];
    playerState.andar = p[1] - ALTURA_OLHOS >= 2 ? 1 : 0;

    camera.position.set(p[0], p[1], p[2]);
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null; // controle puro: nada é renderizado
}
