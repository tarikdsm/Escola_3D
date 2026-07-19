/**
 * canvasTextures.ts — Texturas PROCEDURAIS desenhadas em canvas 2D.
 *
 * Regra do projeto: ZERO assets externos. Todo "texto" visível no mundo 3D
 * é rasterizado aqui (CanvasTexture) em vez de <Text> do drei (que buscaria
 * fonte via CDN). Todas as texturas são cacheadas (criadas uma única vez).
 */

import * as THREE from 'three';

type Desenho = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/** Cria uma CanvasTexture a partir de uma função de desenho 2D. */
function criarTextura(largura: number, altura: number, desenhar: Desenho): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D indisponível para gerar CanvasTexture.');
  desenhar(ctx, largura, altura);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// Piso quadriculado (cerâmica clara) — cache por par de cores
// ---------------------------------------------------------------------------

const cachePiso = new Map<string, THREE.CanvasTexture>();

/**
 * Textura de piso quadriculado 4×4 (cada quadrante ≈ 1 m quando repetida
 * com `repeat.set(w/4, d/4)`). Retorne o clone ao aplicar repeat próprio.
 */
export function texturaPisoQuadriculado(corA: string, corB: string): THREE.CanvasTexture {
  const chave = `${corA}|${corB}`;
  let tex = cachePiso.get(chave);
  if (!tex) {
    tex = criarTextura(256, 256, (ctx, w, h) => {
      const n = 4;
      const t = w / n;
      const tj = h / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? corA : corB;
          ctx.fillRect(i * t, j * tj, t, tj);
          // Rejunte claro entre as placas.
          ctx.strokeStyle = 'rgba(90, 80, 60, 0.25)';
          ctx.lineWidth = 2;
          ctx.strokeRect(i * t + 1, j * tj + 1, t - 2, tj - 2);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    cachePiso.set(chave, tex);
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Azulejo (cozinha/banheiros) — cache por cor
// ---------------------------------------------------------------------------

const cacheAzulejo = new Map<string, THREE.CanvasTexture>();

/** Parede de azulejo 6×6 com rejunte claro. */
export function texturaAzulejo(cor: string): THREE.CanvasTexture {
  let tex = cacheAzulejo.get(cor);
  if (!tex) {
    tex = criarTextura(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#f5f5f0';
      ctx.fillRect(0, 0, w, h);
      const n = 6;
      const t = w / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = cor;
          ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
          // Brilho simples no canto superior esquerdo do azulejo.
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(i * t + 2, j * t + 2, t - 4, 5);
        }
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    cacheAzulejo.set(cor, tex);
  }
  return tex;
}

// ---------------------------------------------------------------------------
// Cartazes educativos das salas de aula
// ---------------------------------------------------------------------------

let texAlfabeto: THREE.CanvasTexture | null = null;

/** Cartaz com o alfabeto colorido. */
export function texturaAlfabeto(): THREE.CanvasTexture {
  if (texAlfabeto) return texAlfabeto;
  texAlfabeto = criarTextura(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#fdf6e3';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e76f51';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ALFABETO', w / 2, 54);
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cores = ['#e63946', '#f4a261', '#2a9d8f', '#9b5de5', '#00b4d8', '#e76f51'];
    const cols = 7;
    const cw = (w - 60) / cols;
    const ch = (h - 110) / 4;
    ctx.font = 'bold 46px sans-serif';
    for (let i = 0; i < letras.length; i++) {
      const c = i % cols;
      const l = Math.floor(i / cols);
      ctx.fillStyle = cores[i % cores.length];
      ctx.fillText(letras[i], 30 + cw * (c + 0.5), 110 + ch * (l + 0.78));
    }
  });
  return texAlfabeto;
}

let texTabuada: THREE.CanvasTexture | null = null;

/** Cartaz com a tabuada de 1 a 10. */
export function texturaTabuada(): THREE.CanvasTexture {
  if (texTabuada) return texTabuada;
  texTabuada = criarTextura(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#eef6fb';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2a9d8f';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TABUADA', w / 2, 54);
    const cols = 10;
    const cw = (w - 60) / cols;
    const ch = (h - 110) / 10;
    ctx.font = 'bold 21px sans-serif';
    for (let l = 0; l < 10; l++) {
      for (let c = 0; c < 10; c++) {
        ctx.fillStyle = l === c ? '#e76f51' : '#3a4a6b';
        ctx.fillText(String((l + 1) * (c + 1)), 30 + cw * (c + 0.5), 104 + ch * (l + 0.8));
      }
    }
  });
  return texTabuada;
}

let texMapa: THREE.CanvasTexture | null = null;

/** Cartaz com mapa estilizado do Brasil (silhueta simplificada). */
export function texturaMapaBrasil(): THREE.CanvasTexture {
  if (texMapa) return texMapa;
  texMapa = criarTextura(512, 384, (ctx, w, h) => {
    // Oceano.
    ctx.fillStyle = '#a8dadc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#457b9d';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BRASIL', w / 2, 52);
    // Silhueta aproximada do território (coordenadas normalizadas 0..1).
    const silhueta: [number, number][] = [
      [0.3, 0.2], [0.42, 0.14], [0.55, 0.15], [0.68, 0.2], [0.8, 0.26],
      [0.9, 0.34], [0.86, 0.42], [0.8, 0.48], [0.74, 0.55], [0.66, 0.6],
      [0.6, 0.68], [0.56, 0.78], [0.52, 0.9], [0.46, 0.86], [0.42, 0.76],
      [0.38, 0.66], [0.3, 0.58], [0.22, 0.52], [0.14, 0.44], [0.18, 0.34],
      [0.24, 0.28],
    ];
    const ox = w * 0.08;
    const oy = h * 0.12;
    const escala = Math.min(w, h) * 0.85;
    ctx.beginPath();
    silhueta.forEach(([px, py], i) => {
      const X = ox + px * escala;
      const Y = oy + py * escala;
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    });
    ctx.closePath();
    ctx.fillStyle = '#7ec850';
    ctx.fill();
    ctx.strokeStyle = '#3f9e4d';
    ctx.lineWidth = 4;
    ctx.stroke();
  });
  return texMapa;
}

// ---------------------------------------------------------------------------
// Cartaz "MERENDA" da cantina
// ---------------------------------------------------------------------------

let texMerenda: THREE.CanvasTexture | null = null;

/** Cartaz pendurado sobre o balcão da cantina. */
export function texturaMerenda(): THREE.CanvasTexture {
  if (texMerenda) return texMerenda;
  texMerenda = criarTextura(512, 192, (ctx, w, h) => {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e76f51';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MERENDA', w / 2 - 40, h / 2 + 30);
    // Maçã estilizada.
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(w - 90, h / 2 + 6, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a4a21';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w - 90, h / 2 - 26);
    ctx.lineTo(w - 86, h / 2 - 44);
    ctx.stroke();
    ctx.fillStyle = '#3f9e4d';
    ctx.beginPath();
    ctx.ellipse(w - 76, h / 2 - 42, 14, 7, 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  return texMerenda;
}

// ---------------------------------------------------------------------------
// Diploma da diretoria
// ---------------------------------------------------------------------------

let texDiploma: THREE.CanvasTexture | null = null;

/** Diploma emoldurado na parede da diretoria. */
export function texturaDiploma(): THREE.CanvasTexture {
  if (texDiploma) return texDiploma;
  texDiploma = criarTextura(384, 288, (ctx, w, h) => {
    ctx.fillStyle = '#f7f2e7';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1d3557';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 44px serif';
    ctx.fillText('DIPLOMA', w / 2, 80);
    ctx.font = '20px serif';
    ctx.fillText('Escola Municipal Brasileira', w / 2, 130);
    ctx.fillText('Certificado de Honra ao Mérito', w / 2, 162);
    ctx.strokeStyle = '#8b8f98';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 90, 216);
    ctx.lineTo(w / 2 + 90, 216);
    ctx.stroke();
    ctx.font = '16px serif';
    ctx.fillText('Direção', w / 2, 238);
  });
  return texDiploma;
}

// ---------------------------------------------------------------------------
// Quadro de avisos da sala dos professores
// ---------------------------------------------------------------------------

let texAvisos: THREE.CanvasTexture | null = null;

/** Quadro de cortiça com papéis coloridos presos por tachinhas. */
export function texturaQuadroAvisos(): THREE.CanvasTexture {
  if (texAvisos) return texAvisos;
  texAvisos = criarTextura(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#c98d5a'; // cortiça
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    const papeis: { x: number; y: number; pw: number; ph: number; cor: string; rot: number }[] = [
      { x: 60, y: 50, pw: 110, ph: 90, cor: '#f5f5f0', rot: -0.08 },
      { x: 210, y: 40, pw: 120, ph: 80, cor: '#ffd166', rot: 0.06 },
      { x: 370, y: 55, pw: 100, ph: 95, cor: '#ffb4a2', rot: -0.05 },
      { x: 90, y: 180, pw: 120, ph: 85, cor: '#b5e48c', rot: 0.07 },
      { x: 250, y: 170, pw: 110, ph: 90, cor: '#a0c4ff', rot: -0.06 },
      { x: 400, y: 185, pw: 90, ph: 80, cor: '#ffc6ff', rot: 0.09 },
    ];
    for (const p of papeis) {
      ctx.save();
      ctx.translate(p.x + p.pw / 2, p.y + p.ph / 2);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.cor;
      ctx.fillRect(-p.pw / 2, -p.ph / 2, p.pw, p.ph);
      // Linhas de "texto" simuladas.
      ctx.strokeStyle = 'rgba(60,60,80,0.5)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-p.pw / 2 + 12, -p.ph / 2 + 22 + i * 16);
        ctx.lineTo(p.pw / 2 - 12, -p.ph / 2 + 22 + i * 16);
        ctx.stroke();
      }
      // Tachinha.
      ctx.fillStyle = '#e63946';
      ctx.beginPath();
      ctx.arc(0, -p.ph / 2 + 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
  return texAvisos;
}

// ---------------------------------------------------------------------------
// Bandeira do Brasil (diretoria)
// ---------------------------------------------------------------------------

let texBandeira: THREE.CanvasTexture | null = null;

/** Bandeira do Brasil: fundo verde, losango amarelo, círculo azul com faixa. */
export function texturaBandeira(): THREE.CanvasTexture {
  if (texBandeira) return texBandeira;
  texBandeira = criarTextura(512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#009c3b';
    ctx.fillRect(0, 0, w, h);
    // Losango amarelo.
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.08);
    ctx.lineTo(w * 0.92, h / 2);
    ctx.lineTo(w / 2, h * 0.92);
    ctx.lineTo(w * 0.08, h / 2);
    ctx.closePath();
    ctx.fillStyle = '#ffdf00';
    ctx.fill();
    // Círculo azul.
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#002776';
    ctx.fill();
    // Faixa branca (arco simplificado).
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, h * 0.24, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = h * 0.045;
    ctx.beginPath();
    ctx.arc(w / 2, h * 1.1, h * 0.62, -Math.PI * 0.82, -Math.PI * 0.18);
    ctx.stroke();
    ctx.restore();
  });
  return texBandeira;
}
