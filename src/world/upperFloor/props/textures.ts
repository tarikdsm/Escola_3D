/**
 * textures.ts — Texturas procedurais via Canvas 2D (ZERO assets externos).
 * Usadas no andar superior: piso quadriculado da laje, cartazes educativos
 * das salas 7–12 e telas abstratas dos cavaletes da Sala de Artes.
 *
 * Regra do projeto: texto visível NUNCA via <Text> do drei (CDN de fontes);
 * sempre desenhado aqui no canvas 2D e aplicado como CanvasTexture.
 */

import * as THREE from 'three';

/** Cria um canvas 2D com contexto garantido (falha rápida se indisponível). */
function criarCanvas(
  largura: number,
  altura: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D indisponível para gerar textura procedural.');
  return { canvas, ctx };
}

/** Converte o canvas em CanvasTexture sRGB, com repetição opcional. */
function paraTextura(
  canvas: HTMLCanvasElement,
  repetirX = 1,
  repetirY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repetirX, repetirY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** RNG determinístico (mulberry32) para composições estáveis entre recargas. */
function rngSemeado(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Piso quadriculado claro (cerâmica de escola pública).
 * Cada tile do canvas cobre 0,5 m; o canvas inteiro cobre 4 m × 4 m.
 */
export function texturaPisoQuadriculado(
  corA: string,
  corB: string,
  larguraM: number,
  profundidadeM: number,
): THREE.CanvasTexture {
  const { canvas, ctx } = criarCanvas(256, 256);
  const tiles = 8;
  const passo = 256 / tiles;
  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? corA : corB;
      ctx.fillRect(i * passo, j * passo, passo, passo);
    }
  }
  // Rejunte sutil.
  ctx.strokeStyle = 'rgba(90, 80, 60, 0.25)';
  ctx.lineWidth = 2;
  for (let k = 0; k <= tiles; k++) {
    ctx.beginPath();
    ctx.moveTo(k * passo, 0);
    ctx.lineTo(k * passo, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, k * passo);
    ctx.lineTo(256, k * passo);
    ctx.stroke();
  }
  return paraTextura(canvas, larguraM / 4, profundidadeM / 4);
}

/** Moldura branca padrão dos cartazes. */
function moldura(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = '#f5f5f0';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);
}

/**
 * Cartaz educativo (128×160) — 4 variantes cicladas pelas salas:
 * 0 = alfabeto · 1 = números · 2 = mapa do Brasil · 3 = círculo cromático.
 */
export function texturaCartaz(variante: number): THREE.CanvasTexture {
  const { canvas, ctx } = criarCanvas(128, 160);
  const v = ((variante % 4) + 4) % 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (v === 0) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, 0, 128, 160);
    moldura(ctx, 128, 160);
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('ABC', 64, 46);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#b03a2e';
    ctx.fillText('a b c d e f', 64, 92);
    ctx.fillStyle = '#2a9d8f';
    ctx.fillText('g h i j k l', 64, 118);
  } else if (v === 1) {
    ctx.fillStyle = '#8ecae6';
    ctx.fillRect(0, 0, 128, 160);
    moldura(ctx, 128, 160);
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('1 2 3', 64, 44);
    // Bolinhas de contagem.
    const cores = ['#e63946', '#f4a261', '#2a9d8f', '#9b5de5'];
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = cores[i % cores.length];
      ctx.beginPath();
      ctx.arc(24 + (i % 4) * 27, 92 + Math.floor(i / 4) * 30, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (v === 2) {
    ctx.fillStyle = '#b5e48c';
    ctx.fillRect(0, 0, 128, 160);
    moldura(ctx, 128, 160);
    // "Mapa" estilizado do Brasil (mancha verde low-poly).
    ctx.fillStyle = '#3f9e4d';
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(88, 36);
    ctx.lineTo(98, 66);
    ctx.lineTo(84, 96);
    ctx.lineTo(66, 122);
    ctx.lineTo(52, 100);
    ctx.lineTo(34, 78);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('BRASIL', 64, 142);
  } else {
    ctx.fillStyle = '#ffc6ff';
    ctx.fillRect(0, 0, 128, 160);
    moldura(ctx, 128, 160);
    // Círculo cromático simplificado.
    const cores = ['#e63946', '#f4a261', '#ffdf00', '#2a9d8f', '#00b4d8', '#9b5de5'];
    cores.forEach((cor, i) => {
      const ang = (i / cores.length) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(64 + Math.cos(ang) * 34, 76 + Math.sin(ang) * 34, 13, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('CORES', 64, 142);
  }
  return paraTextura(canvas);
}

/**
 * Tela abstrata (96×128) para os cavaletes da Sala de Artes —
 * formas geométricas alegres dispostas de forma determinística por variante.
 */
export function texturaArteAbstrata(variante: number): THREE.CanvasTexture {
  const { canvas, ctx } = criarCanvas(96, 128);
  // Fundo de "tela" (canvas de pintura).
  ctx.fillStyle = '#f7f2e7';
  ctx.fillRect(0, 0, 96, 128);
  const rng = rngSemeado(1234 + variante * 987);
  const cores = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5', '#00b4d8', '#ffcf3f'];
  const formas = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < formas; i++) {
    ctx.fillStyle = cores[Math.floor(rng() * cores.length)];
    const x = 10 + rng() * 76;
    const y = 10 + rng() * 108;
    const tipo = rng();
    if (tipo < 0.4) {
      ctx.beginPath();
      ctx.arc(x, y, 6 + rng() * 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (tipo < 0.7) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rng() * Math.PI);
      ctx.fillRect(-12, -6, 24 + rng() * 16, 10 + rng() * 10);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 14, y + 12);
      ctx.lineTo(x - 14, y + 12);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Assinatura de canto.
  ctx.fillStyle = 'rgba(30, 30, 30, 0.6)';
  ctx.fillRect(70, 116, 18, 3);
  return paraTextura(canvas);
}
