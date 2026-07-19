/**
 * Minimap.tsx — mapa 2D da escola no canto inferior esquerdo (componente DOM
 * comum, montado FORA do <Canvas>).
 *
 * - Camada ESTÁTICA (terreno, blocos, salas do andar exibido, quadra, mastro,
 *   portão) é redesenhada só quando `andarMinimap` muda, num canvas offscreen.
 * - Camada DINÂMICA (personagens do andar exibido + jogador) roda num rAF
 *   próprio a ~10 Hz, lendo SIM.pos/playerState direto dos buffers (sem
 *   passar pelo React).
 * - Escala: o TERRENO inteiro cabe na largura do canvas, com margem.
 */

import { useEffect, useRef } from 'react';
import { PALETTE } from '../contracts/palette';
import { PATIO, PORTARIA, QUADRA, SALAS, TERRENO } from '../contracts/layout';
import { ROSTER } from '../contracts/roster';
import { SIM, playerState } from '../contracts/simBuffer';
import type { Andar, Papel, SalaDef } from '../contracts/types';
import { useSchoolStore } from '../state/useSchoolStore';
import './ui.css';

const LARGURA = 220;
const MARGEM = 10;
/** Escala mapa = px/metro: encaixa o TERRENO (140 × 92,5 m) com margem. */
const ESCALA = (LARGURA - 2 * MARGEM) / (TERRENO.maxX - TERRENO.minX);
const ALTURA = Math.round((TERRENO.maxZ - TERRENO.minZ) * ESCALA + 2 * MARGEM);

/** Cores dos pontos por papel: aluno azul, professor verde, equipe laranja. */
const COR_PAPEL: Record<Papel, string> = {
  ALUNO: '#3b82d6',
  PROFESSOR: '#2e9e5b',
  DIRETORA: '#e8833a',
  SECRETARIO: '#e8833a',
  COZINHEIRA: '#e8833a',
  FAXINEIRO: '#e8833a',
  PORTEIRO: '#e8833a',
};

/** Plantas dos dois blocos (contorno externo das paredes). */
const BLOCO_A = { x: -33, z: -32, w: 66, d: 12 };
const BLOCO_B = { x: -29, z: 10, w: 58, d: 10 };

/** Rótulo curto da sala no mapa (salas de aula viram S1…S12). */
function rotuloSala(s: SalaDef): string {
  if (s.tipo === 'aula') return s.nome.replace('Sala ', 'S');
  switch (s.id) {
    case 'refeitorio':
      return 'Refeitório';
    case 'banheiro-m':
      return 'WC M';
    case 'banheiro-f':
      return 'WC F';
    case 'secretaria':
      return 'Secretaria';
    case 'diretoria':
      return 'Diretoria';
    case 'sala-professores':
      return 'Professores';
    case 'biblioteca':
      return 'Biblioteca';
    case 'auditorio':
      return 'Auditório';
    case 'laboratorio':
      return 'Laboratório';
    case 'sala-artes':
      return 'Artes';
    default:
      return s.nome;
  }
}

/** Converte coordenadas do mundo (m) para pixels do canvas. */
function paraMapa(x: number, z: number): [number, number] {
  return [MARGEM + (x - TERRENO.minX) * ESCALA, MARGEM + (z - TERRENO.minZ) * ESCALA];
}

function rectParaMapa(
  ctx: CanvasRenderingContext2D,
  r: { x: number; z: number; w: number; d: number },
  preencher: string,
  contorno?: string,
): void {
  const [mx, my] = paraMapa(r.x, r.z);
  ctx.fillStyle = preencher;
  ctx.fillRect(mx, my, r.w * ESCALA, r.d * ESCALA);
  if (contorno) {
    ctx.strokeStyle = contorno;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, r.w * ESCALA, r.d * ESCALA);
  }
}

/** Desenha a camada estática do andar (terreno, blocos, salas, quadra…). */
function desenharEstatico(ctx: CanvasRenderingContext2D, andar: Andar): void {
  ctx.clearRect(0, 0, LARGURA, ALTURA);

  // Terreno + muro (borda).
  rectParaMapa(
    ctx,
    { x: TERRENO.minX, z: TERRENO.minZ, w: TERRENO.maxX - TERRENO.minX, d: TERRENO.maxZ - TERRENO.minZ },
    PALETTE.pisoPatio,
    '#8b8578',
  );

  // Quadra poliesportiva.
  rectParaMapa(ctx, QUADRA.rect, PALETTE.quadraPiso, PALETTE.quadraFaixa);

  // Blocos A e B (área construída, inclui corredores/varandas).
  rectParaMapa(ctx, BLOCO_A, PALETTE.pisoCorredor, '#8b8578');
  rectParaMapa(ctx, BLOCO_B, PALETTE.pisoCorredor, '#8b8578');

  // Salas do andar exibido, com a cor de destaque e rótulo (se couber).
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const sala of SALAS) {
    if (sala.andar !== andar) continue;
    rectParaMapa(ctx, sala.rect, sala.corDestaque ?? PALETTE.pisoSala, 'rgba(0,0,0,0.25)');
    const rotulo = rotuloSala(sala);
    const aula = sala.tipo === 'aula';
    ctx.font = aula ? '700 8px system-ui, sans-serif' : '600 6.5px system-ui, sans-serif';
    const cabe = ctx.measureText(rotulo).width <= sala.rect.w * ESCALA - 2;
    if (cabe) {
      ctx.fillStyle = 'rgba(27,18,16,0.8)';
      const [cx, cy] = paraMapa(sala.rect.x + sala.rect.w / 2, sala.rect.z + sala.rect.d / 2);
      ctx.fillText(rotulo, cx, cy);
    }
  }

  // Mastro da bandeira (pátio central).
  const [mx, my] = paraMapa(PATIO.mastro[0], PATIO.mastro[2]);
  ctx.fillStyle = PALETTE.mastro;
  ctx.strokeStyle = '#5b5b5b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Guarita do porteiro.
  rectParaMapa(ctx, PORTARIA.guarita, PALETTE.guarita, '#8b8578');

  // Portão da rua (vão no muro sul): trecho em azul.
  const [p1x, p1y] = paraMapa(PORTARIA.portao.pos[0] - PORTARIA.portao.largura / 2, TERRENO.maxZ);
  const [p2x, p2y] = paraMapa(PORTARIA.portao.pos[0] + PORTARIA.portao.largura / 2, TERRENO.maxZ);
  ctx.strokeStyle = PALETTE.portaoMetal;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.stroke();
}

export function Minimap() {
  const andarMinimap = useSchoolStore((s) => s.andarMinimap);
  const setAndarMinimap = useSchoolStore((s) => s.setAndarMinimap);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const estaticoRef = useRef<HTMLCanvasElement | null>(null);

  // Redesenha a camada estática quando o andar exibido muda.
  useEffect(() => {
    const folha = estaticoRef.current ?? document.createElement('canvas');
    folha.width = LARGURA;
    folha.height = ALTURA;
    const ctx = folha.getContext('2d');
    if (!ctx) return;
    desenharEstatico(ctx, andarMinimap);
    estaticoRef.current = folha;
  }, [andarMinimap]);

  // Camada dinâmica: rAF próprio a ~10 Hz lendo os buffers diretamente.
  useEffect(() => {
    let raf = 0;
    let ultimo = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - ultimo < 100) return; // ~10 Hz
      ultimo = t;

      const canvas = canvasRef.current;
      const estatico = estaticoRef.current;
      if (!canvas || !estatico) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, LARGURA, ALTURA);
      ctx.drawImage(estatico, 0, 0);

      const andar = useSchoolStore.getState().andarMinimap;
      const selecionadoId = useSchoolStore.getState().selecionadoId;

      // Pontos dos personagens do andar exibido.
      for (let i = 0; i < ROSTER.length; i++) {
        const y = SIM.pos[i * 3 + 1];
        const andarPersonagem: Andar = y >= 1.5 ? 1 : 0;
        if (andarPersonagem !== andar) continue;
        const [mx, my] = paraMapa(SIM.pos[i * 3], SIM.pos[i * 3 + 2]);
        ctx.fillStyle = COR_PAPEL[ROSTER[i].papel];
        ctx.beginPath();
        ctx.arc(mx, my, 2.2, 0, Math.PI * 2);
        ctx.fill();
        if (ROSTER[i].id === selecionadoId) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(mx, my, 4.2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Ponto do jogador (destaque com anel branco).
      const [px, py] = paraMapa(playerState.pos[0], playerState.pos[2]);
      ctx.fillStyle = '#1d3557';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px, py, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="minimap">
      <canvas ref={canvasRef} width={LARGURA} height={ALTURA} className="minimap-canvas" />
      <div className="minimap-segmentos" role="group" aria-label="Andar do minimapa">
        <button
          type="button"
          className={`hud-botao${andarMinimap === 0 ? ' ativo' : ''}`}
          onClick={() => setAndarMinimap(0)}
        >
          Térreo
        </button>
        <button
          type="button"
          className={`hud-botao${andarMinimap === 1 ? ' ativo' : ''}`}
          onClick={() => setAndarMinimap(1)}
        >
          1º Andar
        </button>
      </div>
      <div className="minimap-legenda">
        <span>
          <span className="ponto" style={{ background: COR_PAPEL.ALUNO }} />
          alunos
        </span>
        <span>
          <span className="ponto" style={{ background: COR_PAPEL.PROFESSOR }} />
          professores
        </span>
        <span>
          <span className="ponto" style={{ background: COR_PAPEL.DIRETORA }} />
          equipe
        </span>
      </div>
    </div>
  );
}
