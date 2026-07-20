/**
 * palette.ts — Paleta de cores do MUNDO (não dos personagens; essas ficam em roster.ts).
 * Estilo: low-poly alegre e colorido, típico de escola pública brasileira.
 * Todos os agentes de arquitetura/render DEVEM usar estas constantes.
 */
export const PALETTE = {
  // --- Céu e luz ---
  ceu: '#87ceeb',
  sol: '#fff2cc',

  // --- Blocos (fachadas externas) ---
  paredeBlocoA: '#ffe4b3', // creme amarelado (bloco norte)
  paredeBlocoB: '#ffd29e', // creme alaranjado (bloco sul)
  paredeInterna: '#f7f2e7', // off-white dos interiores
  faixaAzulejo: '#7fb7d9', // faixa de azulejo na base das paredes internas

  // --- Pisos ---
  pisoPatio: '#cfc6b4', // concreto claro do pátio
  pisoCorredor: '#bdb5a3', // concreto dos corredores/varandas
  pisoSala: '#d9c9a8', // piso claro das salas de aula
  pisoRefeitorio: '#c9d6d2',
  pisoBanheiro: '#bcd4de',
  pisoAuditorio: '#c9a06b',
  grama: '#7ec850', // gramado dos jardins
  terraCanteiro: '#6b4a2b',

  // --- Telhados ---
  telhadoA: '#c94f3d', // terracota do bloco A
  telhadoB: '#b8472f', // terracota do bloco B
  laje: '#a9a294', // laje/parapeito de cobertura

  // --- Esquadrias e estruturas ---
  portaMadeira: '#8a5a2b',
  janelaVidro: '#9fd4e8',
  janelaMoldura: '#f5f5f0',
  guardaCorpo: '#4a6fa5', // guarda-corpo azul das varandas
  corrimao: '#3b5998',
  degrauBocel: '#8d8474', // filete de contraste no nariz dos degraus (leitura do espelho)
  coluna: '#f0e8d8',

  // --- Muros, portão e rua ---
  muro: '#e8e0d0',
  portaoMetal: '#5b8fd6', // portão de ferro azul
  guarita: '#fff3d6',
  calcada: '#b8b2a6',
  rua: '#6e6a63',
  faixaPedestre: '#f5f5f0',

  // --- Quadra poliesportiva ---
  quadraPiso: '#4f9e57', // verde-esporte
  quadraFaixa: '#3d7d46', // bordas mais escuras
  quadraLinha: '#f5f5f0',
  alambrado: '#aeb8c2',
  trave: '#f5f5f0',
  tabelaBasquete: '#e8833a',
  aroBasquete: '#d64541',

  // --- Pátio / mobiliário urbano ---
  banco: '#c98d5a',
  bancoPé: '#6e6a63',
  arvoreCopa: '#3f9e4d',
  arvoreCopaClara: '#58b968',
  tronco: '#7a4a21',
  mastro: '#d9d9d9',
  bandeiraVerde: '#009c3b',
  bandeiraAmarela: '#ffdf00',
  bandeiraAzul: '#002776',
  florVermelha: '#e63946',
  florAmarela: '#ffcf3f',
  florRoxa: '#9b5de5',

  // --- Mobiliário interno ---
  carteira: '#d9a066', // tampo das carteiras
  carteiraMetal: '#8b8f98',
  quadroVerde: '#2e6b4f',
  mesaProfessor: '#a9743b',
  cadeira: '#4a6fa5',
  balcaoCantina: '#e8e8e8',
  balcaoInox: '#c0c6cc',
  estanteLivros: '#8a5a2b',
  livros: ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5', '#00b4d8'],
  palco: '#8b5e3c',
  cortina: '#b03a2e',
  bancadaLab: '#dfe6e9',

  // --- Uniformes (base; paletas individuais ficam em roster.ts) ---
  uniformeCamisaBranca: '#f5f5f0',
  uniformeCamisaAzul: '#bcd9f7',
  uniformeCalca: '#3a4a6b',
  aventalCozinha: '#f5f5f0',

  // --- Letreiro da fachada ---
  letreiroFundo: '#1d3557',
  letreiroTexto: '#f5f5f0',
} as const;

/** Nome das chaves da paleta (para referência tipada). */
export type CorMundo = keyof typeof PALETTE;
