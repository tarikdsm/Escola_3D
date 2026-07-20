/**
 * quadroBranco.ts — Conteúdo de aula + revelação progressiva dos QUADROS
 * BRANCOS de pincel marcador das 32 salas de aula (módulo PURO, sem React).
 *
 * Como funciona:
 * - O conteúdo COMPLETO da aula de cada matéria é renderizado UMA única vez
 *   num canvas offscreen (~640×256, proporção ≈ 2,5:1), com cara de escrita
 *   à mão (fonte 'Segoe Print'/'Comic Sans MS', linhas com rotação de ±0,5°
 *   via RNG semeado por sala — composição estável entre recargas);
 * - Só as 3 cores de marcador: título/tema em AZUL, desenvolvimento em PRETO,
 *   destaques/respostas/sublinhados em VERMELHO (diagramas com lineCap round);
 * - `revelar(p)` (p ∈ 0..1) copia o offscreen para o canvas visível da
 *   esquerda para a direita, com frente de corte irregular (5 faixas
 *   verticais com jitter pré-computado de ±4 px) — parece a mão escrevendo.
 *   Chamadas com |Δp| < 0,005 são ignoradas; nada é alocado nos redraws;
 * - A `CanvasTexture` retornada recebe `needsUpdate = true` a cada redraw.
 *
 * Integração: `src/world/QuadrosBrancos.tsx` (superfícies + relógio do jogo).
 * Molduras/bandejas/marcadores físicos ficam nas integrações dos dois pisos.
 * Regra do projeto: nada de <Text> do drei nem assets externos — tudo canvas 2D.
 */

import * as THREE from 'three';
import { IDS_SALAS_AULA } from '../contracts/layout';

// ---------------------------------------------------------------------------
// Cores dos marcadores e da superfície (locais — contracts/palette intactos)
// ---------------------------------------------------------------------------

/** As únicas 3 cores de "tinta" usadas no conteúdo (e nas tampas dos pincéis). */
export const COR_MARCADOR = {
  preto: '#22252d',
  azul: '#1e40af',
  vermelho: '#c81e1e',
} as const;

/** Branco levemente quente da superfície melamínica do quadro. */
export const COR_SUPERFICIE = '#fbfbf7';

/** Dimensões do canvas do quadro (proporção 2,5:1). */
const W = 640;
const H = 256;

const FONTE = `'Segoe Print', 'Comic Sans MS', cursive`;

// ---------------------------------------------------------------------------
// Mapa sala → matéria (rotação das 12 matérias do roster pelas 32 salas:
// sala-1…12 mantêm o conteúdo original; sala-13…32 repetem o ciclo)
// ---------------------------------------------------------------------------

/** As 12 matérias com conteúdo desenhado, na ordem do roster (sala-1…12). */
const MATERIAS_ORDEM = [
  'portugues',
  'matematica',
  'historia',
  'geografia',
  'ciencias',
  'ingles',
  'artes',
  'edfisica',
  'fisica',
  'quimica',
  'biologia',
  'redacao',
] as const;

type Materia = (typeof MATERIAS_ORDEM)[number];

/** Gerado de IDS_SALAS_AULA (32 salas): nada de hardcode por número de salas. */
const MATERIA_POR_SALA: Record<string, Materia> = Object.fromEntries(
  IDS_SALAS_AULA.map((id, k) => [id, MATERIAS_ORDEM[k % MATERIAS_ORDEM.length]]),
);

// ---------------------------------------------------------------------------
// Utilitários (RNG determinístico, hash, helpers de desenho)
// ---------------------------------------------------------------------------

/** RNG determinístico (mulberry32) — mesmo tremor de mão a cada recarga. */
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

/** Hash FNV-1a do id da sala, para semear o RNG do conteúdo. */
function hashTexto(t: string): number {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Ctx = CanvasRenderingContext2D;

/** Escreve uma linha com leve rotação (±0,5°) e devolve a largura medida. */
function escreve(
  ctx: Ctx,
  rng: () => number,
  texto: string,
  x: number,
  y: number,
  cor: string,
  px: number,
  alinhar: CanvasTextAlign = 'left',
): number {
  ctx.save();
  ctx.font = `${px}px ${FONTE}`;
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = cor;
  const largura = ctx.measureText(texto).width;
  ctx.translate(x, y);
  ctx.rotate((rng() - 0.5) * 0.0175); // ±0,5° — tremor natural da escrita
  ctx.fillText(texto, 0, 0);
  ctx.restore();
  return largura;
}

/** Escreve fórmula com subscritos (ex.: H₂O) e devolve a largura total. */
function escreveFormula(
  ctx: Ctx,
  partes: readonly { t: string; sub?: boolean }[],
  x: number,
  y: number,
  cor: string,
  px: number,
): number {
  ctx.save();
  ctx.fillStyle = cor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let cx = x;
  for (const p of partes) {
    ctx.font = `${p.sub ? Math.round(px * 0.65) : px}px ${FONTE}`;
    ctx.fillText(p.t, cx, y + (p.sub ? px * 0.22 : 0));
    cx += ctx.measureText(p.t).width + 1;
  }
  ctx.restore();
  return cx - x;
}

/** Traço reto com pontas arredondadas (cara de pincel marcador). */
function traco(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, cor: string, lw = 3): void {
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

/** Sequência de traços (polígono aberto ou fechado), cantos arredondados. */
function polilinha(
  ctx: Ctx,
  pontos: readonly (readonly [number, number])[],
  cor: string,
  lw = 3,
  fechar = false,
): void {
  if (pontos.length < 2) return;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pontos[0][0], pontos[0][1]);
  for (let i = 1; i < pontos.length; i++) ctx.lineTo(pontos[i][0], pontos[i][1]);
  if (fechar) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Seta simples com ponta preenchida (rótulos, fluxos, timelines). */
function seta(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, cor: string, lw = 3): void {
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const t = 9 + lw;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - t * Math.cos(ang - 0.42), y1 - t * Math.sin(ang - 0.42));
  ctx.lineTo(x1 - t * Math.cos(ang + 0.42), y1 - t * Math.sin(ang + 0.42));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Círculo (contorno sempre; preenchimento opcional). */
function circulo(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  cor: string,
  lw = 3,
  preenchimento?: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (preenchimento) {
    ctx.fillStyle = preenchimento;
    ctx.fill();
  }
  ctx.strokeStyle = cor;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
}

/** Sublinhado à mão (traço grosso curto sob um texto). */
function sublinha(ctx: Ctx, x: number, y: number, largura: number, cor: string): void {
  traco(ctx, x, y, x + largura, y, cor, 2.5);
}

/** Tema da aula no topo esquerdo, em azul, com sublinhado. */
function titulo(ctx: Ctx, rng: () => number, texto: string): void {
  const w = escreve(ctx, rng, texto, 26, 42, COR_MARCADOR.azul, 27);
  sublinha(ctx, 26, 52, w, COR_MARCADOR.azul);
}

// ---------------------------------------------------------------------------
// Conteúdo de aula por matéria (canvas 640×256; azul = tema, preto = aula,
// vermelho = destaques/respostas)
// ---------------------------------------------------------------------------

type DesenhaConteudo = (ctx: Ctx, rng: () => number) => void;

/** sala-1 · Português: análise sintática de uma oração. */
const conteudoPortugues: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Análise sintática');
  // Oração desenhada por partes, medindo larguras p/ sublinhar cada termo.
  const y = 116;
  const x = 50;
  const w1 = escreve(ctx, rng, 'Os alunos', x, y, P, 26);
  const w2 = escreve(ctx, rng, ' leram', x + w1, y, P, 26);
  const w3 = escreve(ctx, rng, ' o livro.', x + w1 + w2, y, P, 26);
  const rotulo = (cx: number, texto: string) => {
    seta(ctx, cx, y + 16, cx, y + 40, P, 2.5);
    escreve(ctx, rng, texto, cx, y + 64, V, 18, 'center');
  };
  sublinha(ctx, x, y + 10, w1, V);
  rotulo(x + w1 / 2, 'sujeito');
  sublinha(ctx, x + w1, y + 10, w2, V);
  rotulo(x + w1 + w2 / 2, 'verbo');
  sublinha(ctx, x + w1 + w2, y + 10, w3, V);
  rotulo(x + w1 + w2 + w3 / 2, 'objeto direto');
  escreve(ctx, rng, 'O núcleo do sujeito é "alunos".', 50, 228, P, 19);
};

/** sala-2 · Matemática: fórmula de Bhaskara + exemplo numérico. */
const conteudoMatematica: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Equação do 2º grau');
  escreve(ctx, rng, 'Δ = b² − 4ac', 44, 104, P, 26);
  escreve(ctx, rng, 'x = (−b ± √Δ) / 2a', 44, 146, P, 26);
  escreve(ctx, rng, 'Ex.: x² − 5x + 6 = 0', 44, 196, P, 21);
  seta(ctx, 316, 189, 352, 189, P, 2.5);
  escreve(ctx, rng, 'Δ = 25 − 24 = 1', 364, 196, P, 21);
  const w = escreve(ctx, rng, "x' = 3   x'' = 2", 44, 238, V, 24);
  sublinha(ctx, 44, 248, w, V);
};

/** sala-3 · História: linha do tempo 1500 / 1822 / 1889. */
const conteudoHistoria: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Brasil: datas marcantes');
  seta(ctx, 56, 158, 596, 158, P, 3); // eixo do tempo
  const marcos: readonly { x: number; data: string; evento: string }[] = [
    { x: 130, data: '1500', evento: 'Descobrimento' },
    { x: 320, data: '1822', evento: 'Independência' },
    { x: 510, data: '1889', evento: 'República' },
  ];
  for (const m of marcos) {
    traco(ctx, m.x, 148, m.x, 168, P, 3);
    escreve(ctx, rng, m.data, m.x, 132, V, 22, 'center');
    escreve(ctx, rng, m.evento, m.x, 192, P, 16, 'center');
  }
  escreve(ctx, rng, 'Do Brasil Colônia à República Federativa', 320, 232, P, 18, 'center');
};

/** sala-4 · Geografia: perfis de relevo + rosa dos ventos. */
const conteudoGeografia: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Relevo e orientação');
  // Perfis de relevo (da esquerda p/ a direita): montanhas, planalto, planície.
  polilinha(ctx, [[40, 218], [85, 150], [130, 218]], P, 3);
  polilinha(ctx, [[110, 218], [155, 165], [200, 218]], P, 3);
  escreve(ctx, rng, 'montanhas', 120, 242, P, 15, 'center');
  polilinha(ctx, [[220, 218], [242, 170], [300, 170], [320, 218]], P, 3);
  escreve(ctx, rng, 'planalto', 270, 242, P, 15, 'center');
  traco(ctx, 340, 218, 412, 218, P, 3);
  escreve(ctx, rng, 'planície', 376, 242, P, 15, 'center');
  // Rosa dos ventos (N em vermelho, demais pontos em preto).
  circulo(ctx, 520, 150, 52, P, 3);
  traco(ctx, 520, 108, 520, 192, P, 2);
  traco(ctx, 478, 150, 562, 150, P, 2);
  escreve(ctx, rng, 'N', 520, 92, V, 22, 'center');
  escreve(ctx, rng, 'S', 520, 230, P, 18, 'center');
  escreve(ctx, rng, 'L', 588, 158, P, 18, 'center');
  escreve(ctx, rng, 'O', 452, 158, P, 18, 'center');
};

/** sala-5 · Ciências: ciclo da água (evaporação/condensação/precipitação). */
const conteudoCiencias: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, azul: A, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Ciclo da água');
  // Sol (fonte de energia, em destaque) com raios.
  circulo(ctx, 92, 105, 20, V, 3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    traco(ctx, 92 + Math.cos(a) * 26, 105 + Math.sin(a) * 26, 92 + Math.cos(a) * 34, 105 + Math.sin(a) * 34, V, 2.5);
  }
  // Mar (3 ondas azuis).
  for (let l = 0; l < 3; l++) {
    const y = 224 + l * 9;
    const pts: [number, number][] = [];
    for (let x = 40; x <= 600; x += 28) pts.push([x, y + ((x / 28) % 2 === 0 ? -4 : 4)]);
    polilinha(ctx, pts, A, 2.5);
  }
  // Nuvem (3 círculos sobrepostos) + chuva.
  circulo(ctx, 310, 102, 20, P, 3);
  circulo(ctx, 345, 94, 24, P, 3);
  circulo(ctx, 380, 103, 19, P, 3);
  for (const x of [315, 340, 365]) traco(ctx, x, 128, x - 6, 152, A, 2.5);
  // Setas e rótulos das etapas.
  seta(ctx, 150, 200, 232, 124, P, 3);
  escreve(ctx, rng, 'evaporação', 62, 165, P, 15);
  escreve(ctx, rng, 'condensação', 345, 64, P, 15, 'center');
  seta(ctx, 432, 130, 432, 206, P, 3);
  escreve(ctx, rng, 'precipitação', 448, 170, P, 15);
  escreve(ctx, rng, 'escoamento', 548, 214, P, 15, 'center');
};

/** sala-6 · Inglês: verb to be com traduções em vermelho. */
const conteudoIngles: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Verb TO BE');
  const linhas: readonly [string, string][] = [
    ['I am', 'eu sou / estou'],
    ['You are', 'você é / está'],
    ['He / She is', 'ele / ela é'],
    ['We are', 'nós somos'],
    ['They are', 'eles são'],
  ];
  linhas.forEach(([en, pt], i) => {
    const y = 98 + i * 31;
    escreve(ctx, rng, en, 70, y, P, 22);
    seta(ctx, 250, y - 7, 296, y - 7, P, 2.5);
    escreve(ctx, rng, pt, 316, y, V, 20);
  });
};

/** sala-7 · Artes: teoria das cores primárias (com os 3 marcadores). */
const conteudoArtes: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, azul: A, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Teoria das cores');
  // Primárias: vermelho e azul preenchidos; o amarelo fica só no contorno
  // (só há 3 marcadores: preto, azul e vermelho!).
  circulo(ctx, 120, 150, 42, V, 3, V);
  escreve(ctx, rng, 'vermelho', 120, 222, P, 16, 'center');
  circulo(ctx, 280, 150, 42, A, 3, A);
  escreve(ctx, rng, 'azul', 280, 222, P, 16, 'center');
  circulo(ctx, 440, 150, 42, P, 3);
  escreve(ctx, rng, 'amarelo', 440, 222, P, 16, 'center');
  escreve(ctx, rng, 'misturando', 570, 138, P, 15, 'center');
  escreve(ctx, rng, 'crio outras', 570, 160, P, 15, 'center');
  escreve(ctx, rng, 'cores!', 570, 184, V, 15, 'center');
};

/** sala-8 · Educação Física: mini-quadra de futsal + regras básicas. */
const conteudoEdFisica: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Futsal: regras');
  // Mini-quadra (linhas em preto): contorno, meio-campo, círculo e áreas.
  polilinha(ctx, [[40, 90], [370, 90], [370, 225], [40, 225]], P, 3, true);
  traco(ctx, 205, 90, 205, 225, P, 2.5);
  circulo(ctx, 205, 157, 26, P, 2.5);
  polilinha(ctx, [[40, 128], [80, 128], [80, 187], [40, 187]], P, 2.5);
  polilinha(ctx, [[330, 128], [370, 128], [370, 187], [330, 187]], P, 2.5);
  // Regras ao lado da quadra.
  escreve(ctx, rng, '- 5 jogadores por time', 412, 112, P, 18);
  escreve(ctx, rng, '- 2 tempos de 20 min', 412, 147, P, 18);
  escreve(ctx, rng, '- faltas: tiro livre', 412, 182, P, 18);
  escreve(ctx, rng, 'sem impedimento!', 412, 217, V, 18);
};

/** sala-9 · Física: velocidade média + gráfico s × t. */
const conteudoFisica: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Velocidade média');
  escreve(ctx, rng, 'v = Δs / Δt', 44, 112, P, 30);
  escreve(ctx, rng, 'Δs = 100 m   Δt = 20 s', 44, 156, P, 20);
  const w = escreve(ctx, rng, 'v = 5 m/s', 44, 200, V, 24);
  sublinha(ctx, 44, 210, w, V);
  // Gráfico s × t do movimento uniforme (reta = velocidade constante).
  traco(ctx, 390, 225, 390, 95, P, 2.5);
  traco(ctx, 390, 225, 615, 225, P, 2.5);
  escreve(ctx, rng, 's (m)', 396, 108, P, 15);
  escreve(ctx, rng, 't (s)', 600, 247, P, 15, 'center');
  traco(ctx, 390, 225, 590, 120, V, 3);
  escreve(ctx, rng, 'v constante', 468, 148, V, 14);
};

/** sala-10 · Química: H₂O / NaCl + escala de pH. */
const conteudoQuimica: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Substâncias e pH');
  escreveFormula(ctx, [{ t: 'H' }, { t: '2', sub: true }, { t: 'O' }], 44, 112, P, 30);
  escreve(ctx, rng, '= água', 122, 112, P, 20);
  escreveFormula(ctx, [{ t: 'NaCl' }], 44, 158, P, 30);
  escreve(ctx, rng, '= sal de cozinha', 142, 158, P, 20);
  // Escala de pH: 0–14, com 7 neutro; extremos em vermelho.
  seta(ctx, 60, 210, 590, 210, P, 3);
  for (const x of [70, 320, 570]) traco(ctx, x, 202, x, 218, P, 2.5);
  escreve(ctx, rng, '0', 70, 236, P, 16, 'center');
  escreve(ctx, rng, '7', 320, 236, P, 16, 'center');
  escreve(ctx, rng, '14', 570, 236, P, 16, 'center');
  escreve(ctx, rng, 'ácido', 195, 192, V, 17, 'center');
  escreve(ctx, rng, 'neutro', 320, 192, P, 17, 'center');
  escreve(ctx, rng, 'básico', 445, 192, V, 17, 'center');
};

/** sala-11 · Biologia: célula animal com setas e rótulos. */
const conteudoBiologia: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Célula animal');
  // Membrana (elipse), núcleo e nucléolo.
  ctx.save();
  ctx.strokeStyle = P;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(170, 165, 105, 72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  circulo(ctx, 170, 165, 30, P, 3);
  circulo(ctx, 170, 165, 6, P, 2, P);
  // Rótulos com setas (termos-chave sublinhados em vermelho).
  const rotulo = (x: number, y: number, texto: string, px: number, py: number) => {
    const w = escreve(ctx, rng, texto, x, y, P, 18);
    sublinha(ctx, x, y + 7, w, V);
    seta(ctx, x - 6, y - 5, px, py, P, 2.5);
  };
  rotulo(430, 102, 'membrana', 262, 122);
  rotulo(430, 165, 'núcleo', 203, 163);
  rotulo(430, 226, 'citoplasma', 235, 192);
  // Diferença-chave p/ a célula vegetal (destaque em vermelho).
  escreve(ctx, rng, 'sem parede celular!', 62, 250, V, 14);
};

/** sala-12 · Redação/Literatura: estrutura introdução/desenvolvimento/conclusão. */
const conteudoRedacao: DesenhaConteudo = (ctx, rng) => {
  const { preto: P, vermelho: V } = COR_MARCADOR;
  titulo(ctx, rng, 'Estrutura da redação');
  const partes: readonly [string, string][] = [
    ['1. Introdução', ' — apresente o tema'],
    ['2. Desenvolvimento', ' — defenda com argumentos'],
    ['3. Conclusão', ' — retome a tese e proponha'],
  ];
  partes.forEach(([termo, desc], i) => {
    const y = 106 + i * 50;
    const w = escreve(ctx, rng, termo, 50, y, V, 22);
    escreve(ctx, rng, desc, 50 + w, y, P, 20);
  });
  escreve(ctx, rng, 'tese = sua opinião!', 320, 246, P, 16, 'center');
};

/** Despachante matéria → desenho do conteúdo. */
const CONTEUDOS: Record<Materia, DesenhaConteudo> = {
  portugues: conteudoPortugues,
  matematica: conteudoMatematica,
  historia: conteudoHistoria,
  geografia: conteudoGeografia,
  ciencias: conteudoCiencias,
  ingles: conteudoIngles,
  artes: conteudoArtes,
  edfisica: conteudoEdFisica,
  fisica: conteudoFisica,
  quimica: conteudoQuimica,
  biologia: conteudoBiologia,
  redacao: conteudoRedacao,
};

// ---------------------------------------------------------------------------
// Fábrica pública
// ---------------------------------------------------------------------------

/** Quadro branco de uma sala: textura viva + controle de revelação. */
export interface QuadroBranco {
  /** Textura do quadro (atualizada a cada `revelar`). */
  texture: THREE.CanvasTexture;
  /** Redesenha no progresso p ∈ 0..1 (ignora chamadas com |Δp| < 0,005). */
  revelar(p: number): void;
  /** Libera a textura da GPU (canvases ficam para o GC). */
  dispose(): void;
}

/**
 * Cria o quadro branco da sala (matéria resolvida pelo mapa sala→matéria).
 * Nasce limpo (p = 0); o conteúdo completo fica pronto no offscreen e é
 * revelado por `revelar`. Lança erro para sala sem matéria mapeada.
 */
export function criarQuadroBranco(salaId: string): QuadroBranco {
  const materia = (MATERIA_POR_SALA as Record<string, Materia | undefined>)[salaId];
  if (!materia) throw new Error(`Sem conteúdo de quadro branco para a sala '${salaId}'.`);

  // 1) Conteúdo COMPLETO, renderizado uma única vez no offscreen.
  const rng = rngSemeado(hashTexto(salaId));
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const octx = off.getContext('2d');
  if (!octx) throw new Error('Contexto 2D indisponível para o quadro branco.');
  CONTEUDOS[materia](octx, rng);

  // 2) Canvas visível + textura three.
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Contexto 2D indisponível para o quadro branco.');
  const vis: CanvasRenderingContext2D = ctx; // alias não-nulo p/ a closure
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  // 3) Frente de escrita irregular: 5 faixas verticais com jitter de ±4 px,
  //    pré-computado — nenhuma alocação/aleatoriedade nos redraws.
  const FAIXAS = 5;
  const jitter = Array.from({ length: FAIXAS }, () => Math.round((rng() - 0.5) * 8));
  const cortesY = Array.from({ length: FAIXAS + 1 }, (_, i) => Math.round((i * H) / FAIXAS));

  let ultimoP = -1; // força o 1º redraw mesmo com p = 0

  function revelar(p: number): void {
    const alvo = p < 0 ? 0 : p > 1 ? 1 : p;
    if (Math.abs(alvo - ultimoP) < 0.005) return;
    ultimoP = alvo;
    // Fundo branco da superfície (apaga qualquer conteúdo anterior).
    vis.fillStyle = COR_SUPERFICIE;
    vis.fillRect(0, 0, W, H);
    if (alvo >= 1) {
      vis.drawImage(off, 0, 0); // aula completa, sem jitter na borda final
    } else if (alvo > 0) {
      const frente = alvo * W;
      for (let i = 0; i < FAIXAS; i++) {
        const corte = Math.max(0, Math.min(W, Math.round(frente + jitter[i])));
        if (corte <= 0) continue;
        const y0 = cortesY[i];
        const h = cortesY[i + 1] - y0;
        vis.drawImage(off, 0, y0, corte, h, 0, y0, corte, h);
      }
    }
    texture.needsUpdate = true;
  }

  revelar(0); // nasce limpo (período CHEGADA)

  return {
    texture,
    revelar,
    dispose: () => texture.dispose(),
  };
}
