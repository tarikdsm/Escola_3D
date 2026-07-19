/**
 * canvasTextures.ts — Texturas procedurais (CanvasTexture) da área EXTERNA.
 *
 * Nenhum asset externo é carregado: tudo é desenhado em canvas 2D do browser.
 * Texturas compartilhadas entre Terrain/Facade/SportsCourt/Patio.
 */
import * as THREE from 'three';
import { PALETTE } from '../../contracts';

/** Cria um canvas 2D com contexto garantido. */
function criarCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D do canvas indisponível');
  return [canvas, ctx];
}

/** Converte o canvas em CanvasTexture com repetição habilitada. */
function paraTextura(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Cimento quadriculado sutil (pátio, calçadas de circulação)
// ---------------------------------------------------------------------------

/** Textura NOVA a cada chamada — o chamador ajusta `repeat` conforme o rect. */
export function texturaCimento(): THREE.CanvasTexture {
  const [canvas, ctx] = criarCanvas(256, 256);
  ctx.fillStyle = PALETTE.pisoPatio;
  ctx.fillRect(0, 0, 256, 256);
  // Manchas sutis de desgaste.
  ctx.fillStyle = 'rgba(0,0,0,0.045)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 67) % 256;
    const y = (i * 131) % 256;
    ctx.fillRect(x, y, 3, 3);
  }
  // Juntas do quadriculado (tile = 4 m × 4 m na prática).
  ctx.strokeStyle = 'rgba(80,72,58,0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = i * 64;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }
  return paraTextura(canvas);
}

// ---------------------------------------------------------------------------
// Tela losangular do alambrado (fundo transparente)
// ---------------------------------------------------------------------------

let telaCache: THREE.CanvasTexture | null = null;

/** Tela de arame losangular, semitransparente (tile ≈ 0,5 m). */
export function texturaTelaAlambrado(): THREE.CanvasTexture {
  if (telaCache) return telaCache;
  const [canvas, ctx] = criarCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = '#cfd6dd';
  ctx.lineWidth = 3;
  for (let i = -4; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 16, 0);
    ctx.lineTo(i * 16 + 64, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * 16, 0);
    ctx.lineTo(i * 16 - 64, 64);
    ctx.stroke();
  }
  telaCache = paraTextura(canvas);
  return telaCache;
}

// ---------------------------------------------------------------------------
// Rede branca (traves de futsal)
// ---------------------------------------------------------------------------

let redeCache: THREE.CanvasTexture | null = null;

/** Grade quadrada branca para as redes dos gols. */
export function texturaRede(): THREE.CanvasTexture {
  if (redeCache) return redeCache;
  const [canvas, ctx] = criarCanvas(64, 64);
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(245,245,240,0.9)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
    const p = i * 8;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 64);
    ctx.moveTo(0, p);
    ctx.lineTo(64, p);
    ctx.stroke();
  }
  redeCache = paraTextura(canvas);
  return redeCache;
}

// ---------------------------------------------------------------------------
// Piso da quadra com as linhas demarcadas (canvas 1200×1000 = 30×25 m a 40 px/m)
// ---------------------------------------------------------------------------

let quadraCache: THREE.CanvasTexture | null = null;

/** Piso esportivo completo: contorno, meio, círculo central, áreas e 3 pontos. */
export function texturaQuadra(): THREE.CanvasTexture {
  if (quadraCache) return quadraCache;
  const PX = 40; // pixels por metro
  const [canvas, ctx] = criarCanvas(30 * PX, 25 * PX);

  // Faixa externa mais escura + campo principal.
  ctx.fillStyle = PALETTE.quadraFaixa;
  ctx.fillRect(0, 0, 30 * PX, 25 * PX);
  ctx.fillStyle = PALETTE.quadraPiso;
  ctx.fillRect(0.8 * PX, 0.8 * PX, 28.4 * PX, 23.4 * PX);

  ctx.strokeStyle = PALETTE.quadraLinha;
  ctx.fillStyle = PALETTE.quadraLinha;
  ctx.lineWidth = 4;

  // Contorno do campo (margem de 1,2 m).
  const m = 1.2 * PX;
  ctx.strokeRect(m, m, 30 * PX - 2 * m, 25 * PX - 2 * m);
  // Linha de meio (gols no eixo X → linha paralela a Z em x=15 m do canvas).
  ctx.beginPath();
  ctx.moveTo(15 * PX, m);
  ctx.lineTo(15 * PX, 25 * PX - m);
  ctx.stroke();
  // Círculo central (raio 3 m) + marca central.
  ctx.beginPath();
  ctx.arc(15 * PX, 12.5 * PX, 3 * PX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(15 * PX, 12.5 * PX, 6, 0, Math.PI * 2);
  ctx.fill();

  for (const lado of [0, 1] as const) {
    // x do fundo do campo (esquerdo ou direito) e direção para dentro.
    const xFundo = lado === 0 ? m : 30 * PX - m;
    const s = lado === 0 ? 1 : -1;
    // Área do gol: 6 m × 10 m centralizada.
    ctx.strokeRect(
      lado === 0 ? xFundo : xFundo - 6 * PX,
      7.5 * PX,
      6 * PX,
      10 * PX,
    );
    // Marca do pênalti a 4 m.
    ctx.beginPath();
    ctx.arc(xFundo + s * 4 * PX, 12.5 * PX, 6, 0, Math.PI * 2);
    ctx.fill();
    // Linha de 3 pontos simplificada: arco de 6,25 m em torno da tabela
    // (tabelas em x 43,5/66,5 → 3,5 m a partir das bordas do rect da quadra).
    ctx.beginPath();
    ctx.arc(
      xFundo + s * 2.3 * PX,
      12.5 * PX,
      6.25 * PX,
      lado === 0 ? -Math.PI / 2 : Math.PI / 2,
      lado === 0 ? Math.PI / 2 : (3 * Math.PI) / 2,
    );
    ctx.stroke();
  }

  quadraCache = paraTextura(canvas);
  return quadraCache;
}

// ---------------------------------------------------------------------------
// Tabela de basquete (frente branca com quadrado alaranjado)
// ---------------------------------------------------------------------------

let tabelaCache: THREE.CanvasTexture | null = null;

/** Face da tabela de basquete. */
export function texturaTabela(): THREE.CanvasTexture {
  if (tabelaCache) return tabelaCache;
  const [canvas, ctx] = criarCanvas(256, 160);
  ctx.fillStyle = PALETTE.quadraLinha;
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = PALETTE.tabelaBasquete;
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, 244, 148);
  ctx.lineWidth = 7;
  ctx.strokeRect(98, 74, 60, 50);
  tabelaCache = paraTextura(canvas);
  return tabelaCache;
}

// ---------------------------------------------------------------------------
// Letreiro da fachada ("E.E. Professora Maria da Glória")
// ---------------------------------------------------------------------------

let letreiroCache: THREE.CanvasTexture | null = null;

/** Placa escura com texto claro, para a fachada sul do Bloco B. */
export function texturaLetreiro(): THREE.CanvasTexture {
  if (letreiroCache) return letreiroCache;
  const [canvas, ctx] = criarCanvas(1536, 192);
  ctx.fillStyle = PALETTE.letreiroFundo;
  ctx.fillRect(0, 0, 1536, 192);
  ctx.strokeStyle = PALETTE.letreiroTexto;
  ctx.lineWidth = 10;
  ctx.strokeRect(10, 10, 1516, 172);
  const texto = 'E.E. PROFESSORA MARIA DA GLÓRIA';
  ctx.fillStyle = PALETTE.letreiroTexto;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let tamanho = 88;
  do {
    ctx.font = `bold ${tamanho}px Arial, sans-serif`;
    tamanho -= 4;
  } while (ctx.measureText(texto).width > 1440 && tamanho > 20);
  ctx.fillText(texto, 768, 100);
  letreiroCache = paraTextura(canvas);
  return letreiroCache;
}

// ---------------------------------------------------------------------------
// Bandeira do Brasil (procedural)
// ---------------------------------------------------------------------------

let bandeiraCache: THREE.CanvasTexture | null = null;

/** Bandeira do Brasil simplificada: verde, losango, círculo e faixa. */
export function texturaBandeira(): THREE.CanvasTexture {
  if (bandeiraCache) return bandeiraCache;
  const [canvas, ctx] = criarCanvas(288, 200);
  // Fundo verde.
  ctx.fillStyle = PALETTE.bandeiraVerde;
  ctx.fillRect(0, 0, 288, 200);
  // Losango amarelo.
  ctx.fillStyle = PALETTE.bandeiraAmarela;
  ctx.beginPath();
  ctx.moveTo(144, 16);
  ctx.lineTo(272, 100);
  ctx.lineTo(144, 184);
  ctx.lineTo(16, 100);
  ctx.closePath();
  ctx.fill();
  // Círculo azul com faixa branca curva (recortada pelo círculo).
  ctx.save();
  ctx.fillStyle = PALETTE.bandeiraAzul;
  ctx.beginPath();
  ctx.arc(144, 100, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = '#f5f5f0';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(92, 92);
  ctx.quadraticCurveTo(144, 124, 196, 88);
  ctx.stroke();
  // Algumas "estrelas" simplificadas.
  ctx.fillStyle = '#f5f5f0';
  for (const [ex, ey] of [
    [120, 122],
    [144, 134],
    [166, 118],
  ] as const) {
    ctx.beginPath();
    ctx.arc(ex, ey, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  bandeiraCache = paraTextura(canvas);
  return bandeiraCache;
}
