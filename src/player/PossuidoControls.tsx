/**
 * PossuidoControls.tsx — MODO TERCEIRA PESSOA (NPC possuído), vai DENTRO do
 * <Canvas>, montado pelo PlayerRig quando modoCam === 'possuido'
 * (remonta a cada troca de possuidoIdx — o PlayerRig usa key={idx}).
 *
 * Modelo mouse-first (ver contracts/store.ts):
 * - Pointer lock (pedido no clique que possuiu — ver picking.ts); o mouse
 *   define a DIREÇÃO do personagem NO PLANO (yaw; ele gira suave para onde
 *   a câmera olha) e o pitch só sobe/desce a câmera — sem voar.
 * - Botão ESQUERDO segurado = andar para frente; SCROLL = zoom (distância
 *   da câmera, 2,5–14 m). A câmera segue atrás/acima com leve amortecimento
 *   (lerp exponencial, k = 1 − exp(−8·dt)) e nunca desce do piso local.
 * - Movimento fisicamente possível: colisão eixo a eixo com WALLS
 *   (moverComColisao), pisos/lajes dos 4 pavimentos e escadas via chaoEm
 *   (rampas com alturaNaRampa + yRef) — ver collision.ts.
 * - O NPC possuído é PULADO pela simulação (skip em step.ts): aqui se
 *   escrevem SIM.pos/facing/anim/phase/speed dele a cada frame — 'walk'
 *   só quando em movimento, 'idle' parado (fatores de fase do agents.ts).
 * - ESC: o browser sai do lock → PlayerRig leva ao modo 'livre' e este
 *   componente desmonta; a posse CONTINUA (o NPC para — cleanup abaixo).
 * - API touch (entrada.ts): mesmas filas do mouse; entradaMover também
 *   move sem pointer lock (mobile) e dá strafe (o mouse não strafa).
 */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CONST, TERRENO } from '../contracts/layout';
import {
  SIM,
  playerState,
  setAnim,
  setFacing,
  setPhase,
  setPosicao,
  setSpeed,
} from '../contracts/simBuffer';
import type { Andar, Vec3 } from '../contracts/types';
import { useSchoolStore } from '../state/useSchoolStore';
import { chaoEm, moverComColisao } from './collision';
import { consumirGiro, consumirZoom, eixosTouch, girarVisao, zoomCam } from './entrada';

const RAIO_CORPO = 0.35; // mesmo raio do antigo jogador a pé
const ALTURA_ALVO = 1.45; // alvo da câmera acima dos pés (~altura da cabeça)
const SENSIBILIDADE = 0.0023; // rad por pixel de mouse
const PITCH_MIN = -1.25; // quase de cima (olhando para baixo)
const PITCH_MAX = 0.55; // um pouco por baixo (olhando para cima)
const DIST_INI = 6;
const DIST_MIN = 2.5;
const DIST_MAX = 14;
const PASSO_ZOOM = 0.02; // m por unidade de delta (notch de ~100 → ~2 m)
const MARGEM_TERRENO = 0.6;
/** Fatores de fase por segundo de jogo (iguais aos de agents.ts). */
const FASE_IDLE = 0.25;
const FASE_WALK = 1.1;
/** Velocidade 2D a partir da qual o NPC aparece andando (m/s). */
const LIMIAR_ANDAR = 0.25;

export function PossuidoControls() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  // Índice do NPC possuído no mount (o PlayerRig remonta se ele mudar).
  const idx = useRef(useSchoolStore.getState().possuidoIdx ?? -1);

  const botoes = useRef<Set<number>>(new Set());
  // Posição dos PÉS do personagem (inicia onde o NPC estava na simulação).
  const pes = useRef<Vec3>([0, 0, 0]);
  const vel = useRef<Vec3>([0, 0, 0]);
  const yaw = useRef(0); // direção da câmera/personagem no plano
  const pitch = useRef(-0.42); // levemente de cima
  const dist = useRef(DIST_INI); // distância da câmera (zoom)
  const facing = useRef(0); // facing atual (interpola até yaw+π)
  const faseAnim = useRef(0);
  const camPos = useRef<Vec3>([0, 0, 0]); // posição amortecida da câmera
  // Scratches do loop (sem alocação por frame).
  const giro = useRef({ dx: 0, dy: 0 });
  const tmpDesejado = useRef<Vec3>([0, 0, 0]);
  const tmpResolvido = useRef<Vec3>([0, 0, 0]);
  const tmpChao = useRef<{ y: number; andar: Andar }>({ y: 0, andar: 0 });

  // Estado inicial a partir dos buffers SIM do NPC (uma vez por montagem).
  useEffect(() => {
    const i = idx.current;
    const i3 = i * 3;
    pes.current[0] = SIM.pos[i3];
    pes.current[1] = SIM.pos[i3 + 1];
    pes.current[2] = SIM.pos[i3 + 2];
    // Convenções: facing do SIM 0 = +Z (dir = (sin f, cos f)); yaw da câmera
    // tem frente planar (−sin yaw, −cos yaw) — daí yaw = facing + π.
    facing.current = SIM.facing[i];
    yaw.current = SIM.facing[i] + Math.PI;
    faseAnim.current = SIM.phase[i];
    vel.current[0] = 0;
    vel.current[1] = 0;
    vel.current[2] = 0;
    camera.rotation.order = 'YXZ';
    // Câmera já nasce no lugar (sem voo de transição).
    const sinY = Math.sin(yaw.current);
    const cosY = Math.cos(yaw.current);
    const sinP = Math.sin(pitch.current);
    const cosP = Math.cos(pitch.current);
    camPos.current[0] = pes.current[0] + sinY * cosP * dist.current;
    camPos.current[1] = pes.current[1] + ALTURA_ALVO - sinP * dist.current;
    camPos.current[2] = pes.current[2] + cosY * cosP * dist.current;
    camera.position.set(camPos.current[0], camPos.current[1], camPos.current[2]);
    camera.rotation.set(pitch.current, yaw.current, 0);
    // Drena resíduo das filas (ex.: API touch usada no modo 'livre').
    consumirGiro(giro.current);
    consumirZoom();
  }, [camera]);

  // Mouse: olhar (mousemove em lock), botão frente, zoom (wheel).
  useEffect(() => {
    const canvas = gl.domElement;

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
      if (useSchoolStore.getState().modoCam !== 'possuido') return;
      zoomCam(-e.deltaY * (e.deltaMode === 1 ? 33 : 1));
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel);
    window.addEventListener('blur', onBlur);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousemove', onMouseMove);
      botoes.current.clear();
      // ESC (modo 'livre') com a posse mantida: o personagem PARA na hora
      // (a simulação não escreve mais nele — o idle fica congelado).
      const st = useSchoolStore.getState();
      if (st.possuidoIdx === idx.current && st.modoCam === 'livre') {
        setAnim(idx.current, 'idle');
        setSpeed(idx.current, 0);
      }
    };
  }, [gl]);

  useFrame((_, dtBruto) => {
    const st = useSchoolStore.getState();
    if (st.modoCam !== 'possuido' || st.possuidoIdx !== idx.current) return;
    const i = idx.current;
    const dt = Math.min(dtBruto, 0.05); // evita saltos ao trocar de aba

    // --- Direção no plano (fila unificada mouse + touch) ---
    consumirGiro(giro.current);
    yaw.current -= giro.current.dx * SENSIBILIDADE;
    pitch.current = Math.max(
      PITCH_MIN,
      Math.min(PITCH_MAX, pitch.current - giro.current.dy * SENSIBILIDADE),
    );

    // --- Zoom: distância da câmera ---
    const zoom = consumirZoom();
    if (zoom !== 0) {
      dist.current = Math.max(DIST_MIN, Math.min(DIST_MAX, dist.current - zoom * PASSO_ZOOM));
    }

    // --- Entrada de movimento: LMB (com lock) + eixos touch ---
    const travado = document.pointerLockElement === gl.domElement;
    let iz = eixosTouch.z;
    let ix = eixosTouch.x;
    if (travado && botoes.current.has(0)) iz += 1;
    if (iz > 1) iz = 1;
    else if (iz < -1) iz = -1;

    const sinY = Math.sin(yaw.current);
    const cosY = Math.cos(yaw.current);
    // Frente planar da câmera = (−sin, −cos); direita = (cos, −sin).
    let alvoX = 0;
    let alvoZ = 0;
    if (iz !== 0 || ix !== 0) {
      const inv = 1 / Math.max(1, Math.hypot(ix, iz));
      alvoX = (-sinY * iz + cosY * ix) * inv * CONST.VEL_ANDAR;
      alvoZ = (-cosY * iz - sinY * ix) * inv * CONST.VEL_ANDAR;
    }

    // Aceleração suave (mesma constante dos outros controladores).
    const k = 1 - Math.exp(-10 * dt);
    vel.current[0] += (alvoX - vel.current[0]) * k;
    vel.current[2] += (alvoZ - vel.current[2]) * k;

    // --- Movimento com colisão eixo a eixo + clamp do terreno ---
    const p = pes.current;
    tmpDesejado.current[0] = p[0] + vel.current[0] * dt;
    tmpDesejado.current[1] = p[1];
    tmpDesejado.current[2] = p[2] + vel.current[2] * dt;
    moverComColisao(p, tmpDesejado.current, RAIO_CORPO, tmpResolvido.current);
    const nx = Math.max(TERRENO.minX + MARGEM_TERRENO, Math.min(TERRENO.maxX - MARGEM_TERRENO, tmpResolvido.current[0]));
    const nz = Math.max(TERRENO.minZ + MARGEM_TERRENO, Math.min(TERRENO.maxZ - MARGEM_TERRENO, tmpResolvido.current[2]));

    // --- Piso (rampa/laje/térreo) com transição suave ---
    const chao = chaoEm(nx, nz, p[1], tmpChao.current);
    let ny: number;
    if (Math.abs(chao.y - p[1]) > 1.5) {
      ny = chao.y; // salto grande (spawn/troca de modo): ajusta na hora
    } else {
      const kv = 1 - Math.exp(-12 * dt);
      ny = p[1] + (chao.y - p[1]) * kv;
    }
    p[0] = nx;
    p[1] = ny;
    p[2] = nz;

    // --- Facing: gira suave para a direção planar da câmera (yaw + π) ---
    let d = (yaw.current + Math.PI - facing.current) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    else if (d < -Math.PI) d += Math.PI * 2;
    facing.current += d * Math.min(1, dt * 10);

    // --- Escreve os buffers do NPC (a simulação pula este índice) ---
    const veloc2d = Math.hypot(vel.current[0], vel.current[2]);
    const andando = veloc2d > LIMIAR_ANDAR;
    const dtJogo = dt * CONST.ESCALA_TEMPO * st.velocidade;
    faseAnim.current = (faseAnim.current + dtJogo * (andando ? FASE_WALK : FASE_IDLE)) % 1;
    setPosicao(i, nx, ny, nz);
    setFacing(i, facing.current);
    setAnim(i, andando ? 'walk' : 'idle');
    setPhase(i, faseAnim.current);
    setSpeed(i, andando ? veloc2d : 0);

    // playerState acompanha o personagem (a "posição do jogador" é a dele).
    playerState.pos[0] = nx;
    playerState.pos[1] = ny;
    playerState.pos[2] = nz;
    playerState.andar = chao.andar;

    // --- Câmera em 3ª pessoa: atrás/acima, com leve amortecimento ---
    const sinP = Math.sin(pitch.current);
    const cosP = Math.cos(pitch.current);
    const desejX = nx + sinY * cosP * dist.current;
    const desejY = ny + ALTURA_ALVO - sinP * dist.current;
    const desejZ = nz + cosY * cosP * dist.current;
    // Nunca abaixo do piso local (a câmera pode atravessar parede — aceito).
    const chaoCam = chaoEm(desejX, desejZ, ny, tmpChao.current);
    const alvoY = Math.max(desejY, chaoCam.y + 0.25);
    const kc = 1 - Math.exp(-8 * dt);
    const c = camPos.current;
    c[0] += (desejX - c[0]) * kc;
    c[1] += (alvoY - c[1]) * kc;
    c[2] += (desejZ - c[2]) * kc;
    camera.position.set(c[0], c[1], c[2]);
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null; // controle puro: nada é renderizado
}
