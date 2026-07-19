/**
 * roster.ts — ELENCO COMPLETO: exatamente 79 personagens.
 *
 * Ordem estável dos índices (0–78), usada nos buffers de simulação (SIM):
 * - 0: DIRETORA · 1: SECRETARIO · 2–13: PROFESSORES (prof-1…prof-12, um por sala)
 * - 14–73: ALUNOS (aluno-1…aluno-60, 5 por sala, sala-1…sala-12)
 * - 74–75: COZINHEIRAS · 76–77: FAXINEIROS · 78: PORTEIRO
 *
 * As paletas são geradas deterministicamente a partir de listas de tons com
 * passos de rotação diferentes, garantindo combinações distintas por personagem.
 *
 * EDIÇÕES DE CONTRATO AUTORIZADAS (melhoria de realismo dos NPCs):
 * 1. Cada entrada ganha `sexo: 'M' | 'F'`, atribuído nome a nome (nomes
 *    próprios brasileiros comuns; alunos alternam F/M na lista original e
 *    foram revisados um a um). Ids, nomes e índices NÃO mudaram.
 * 2. Listas PELES e CABELOS ampliadas (mais tons de pele e de cabelo,
 *    incluindo preto-azulado, castanhos claros e grisalho) — os tons
 *    originais foram mantidos; só há mais variedade nas combinações.
 */

import type { PaletaPersonagem, Papel, PersonagemInfo, Sexo } from './types';

// ---------------------------------------------------------------------------
// Listas de tons (hex) usadas na composição das paletas
// ---------------------------------------------------------------------------

// 10 tons de pele (6 originais + 4 novos intermediários/profundos).
const PELES = [
  '#8d5524', '#a0663a', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac',
  '#6f4520', '#7a4e2d', '#b87a4b', '#eec39a',
];
// 12 cores de cabelo (8 originais + preto-azulado, castanhos, grisalho).
const CABELOS = [
  '#1b1210', '#2e1f16', '#4a2c14', '#6b3f1d', '#8a5a2b', '#3b3b3b',
  '#111111', '#5b3a1e', '#0c0c12', '#7a4a21', '#a06a2c', '#6e6e78',
];
const CAMISAS_EQUIPE = ['#7fb7d9', '#e8a0bf', '#b5e48c', '#ffd166', '#cdb4db', '#90e0a3', '#f4a261', '#8ecae6'];
const CALCAS = ['#3a4a6b', '#2f3e5c', '#5b6470', '#4a3b52', '#37474f'];
const MOCHILAS = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#9b5de5', '#00b4d8', '#ef476f', '#06d6a0', '#f78c6b', '#8338ec'];
const CAMISA_ALUNO = ['#f5f5f0', '#bcd9f7']; // branca ou azul-claro (uniforme)

const pick = <T>(lista: readonly T[], i: number): T => lista[i % lista.length];

/** Paleta com rotação por passos distintos → combinações únicas por índice. */
function paletaAluno(i: number): PaletaPersonagem {
  return {
    pele: pick(PELES, i),
    cabelo: pick(CABELOS, i * 3 + 1),
    camisa: pick(CAMISA_ALUNO, i),
    calca: pick(CALCAS, i * 2 + 1),
    mochila: pick(MOCHILAS, i * 7 + 2),
  };
}

function paletaAdulto(i: number, camisa?: string): PaletaPersonagem {
  return {
    pele: pick(PELES, i * 5 + 2),
    cabelo: pick(CABELOS, i * 3),
    camisa: camisa ?? pick(CAMISAS_EQUIPE, i * 3 + 1),
    calca: pick(CALCAS, i * 2),
  };
}

// ---------------------------------------------------------------------------
// Professores (um por sala 1–12, matérias variadas; sexo por nome próprio)
// ---------------------------------------------------------------------------

const PROFESSORES: { nome: string; materia: string; sexo: Sexo }[] = [
  { nome: 'Mariana Souza Freitas', materia: 'Português', sexo: 'F' },
  { nome: 'Ricardo Almeida Prado', materia: 'Matemática', sexo: 'M' },
  { nome: 'José Carlos Bandeira', materia: 'História', sexo: 'M' },
  { nome: 'Fernanda Lima Peixoto', materia: 'Geografia', sexo: 'F' },
  { nome: 'Paulo Henrique Rezende', materia: 'Ciências', sexo: 'M' },
  { nome: 'Juliana Castro Brito', materia: 'Inglês', sexo: 'F' },
  { nome: 'Tatiane Rocha Valadares', materia: 'Artes', sexo: 'F' },
  { nome: 'Marcelo Dias Figueiredo', materia: 'Educação Física', sexo: 'M' },
  { nome: 'André Luiz Sampaio', materia: 'Física', sexo: 'M' },
  { nome: 'Beatriz Nogueira Sales', materia: 'Química', sexo: 'F' },
  { nome: 'Camila Torres Vasques', materia: 'Biologia', sexo: 'F' },
  { nome: 'Sérgio Moura Guimarães', materia: 'Redação/Literatura', sexo: 'M' },
];

// ---------------------------------------------------------------------------
// Alunos (60 nomes; sala = índice ÷ 5 + 1; sexo revisado nome a nome)
// ---------------------------------------------------------------------------

const ALUNOS: { nome: string; sexo: Sexo }[] = [
  { nome: 'Ana Clara Mendes', sexo: 'F' },
  { nome: 'Pedro Henrique Lopes', sexo: 'M' },
  { nome: 'Maria Eduarda Santos', sexo: 'F' },
  { nome: 'João Pedro Oliveira', sexo: 'M' },
  { nome: 'Laura Beatriz Rocha', sexo: 'F' },
  { nome: 'Gabriel Lucas Ferreira', sexo: 'M' },
  { nome: 'Sofia Almeida Cruz', sexo: 'F' },
  { nome: 'Miguel Arthur Ramos', sexo: 'M' },
  { nome: 'Isabella Vitória Pires', sexo: 'F' },
  { nome: 'Arthur Miguel Barros', sexo: 'M' },
  { nome: 'Alice Gabriela Morais', sexo: 'F' },
  { nome: 'Lucas Emanuel Teles', sexo: 'M' },
  { nome: 'Manuela Cecília Braga', sexo: 'F' },
  { nome: 'Rafael Augusto Pinto', sexo: 'M' },
  { nome: 'Heloísa Maria Campos', sexo: 'F' },
  { nome: 'Enzo Gabriel Ribeiro', sexo: 'M' },
  { nome: 'Valentina Alice Nunes', sexo: 'F' },
  { nome: 'Theo Nicolas Azevedo', sexo: 'M' },
  { nome: 'Júlia Emília Cardoso', sexo: 'F' },
  { nome: 'Bernardo Isaac Moura', sexo: 'M' },
  { nome: 'Cecília Rosa Farias', sexo: 'F' },
  { nome: 'Davi Lucca Moreira', sexo: 'M' },
  { nome: 'Antonella Maria Cunha', sexo: 'F' },
  { nome: 'Samuel Levi Correia', sexo: 'M' },
  { nome: 'Eloá Sophia Gonçalves', sexo: 'F' },
  { nome: 'Caleb Benício Duarte', sexo: 'M' },
  { nome: 'Lara Isabel Fogaça', sexo: 'F' },
  { nome: 'Anthony Gabriel Sales', sexo: 'M' },
  { nome: 'Maria Júlia Peçanha', sexo: 'F' },
  { nome: 'Levi Enrico Barreto', sexo: 'M' },
  { nome: 'Giovanna Lara Mota', sexo: 'F' },
  { nome: 'Benedito Caio Novaes', sexo: 'M' },
  { nome: 'Yasmin Vitória Lins', sexo: 'F' },
  { nome: 'Kauã Miguel Serra', sexo: 'M' },
  { nome: 'Maria Alice Tavares', sexo: 'F' },
  { nome: 'Ravi Lucca Vasquez', sexo: 'M' },
  { nome: 'Agatha Beatriz Leão', sexo: 'F' },
  { nome: 'Noah William Pacheco', sexo: 'M' },
  { nome: 'Maria Cecília Fontes', sexo: 'F' },
  { nome: 'Joaquim Pedro Saldanha', sexo: 'M' },
  { nome: 'Clarice Helena Bastos', sexo: 'F' },
  { nome: 'Otto Gabriel Furtado', sexo: 'M' },
  { nome: 'Marina Sofia Quintela', sexo: 'F' },
  { nome: 'Vicente Arthur Lemos', sexo: 'M' },
  { nome: 'Isabelly Nicole Reis', sexo: 'F' },
  { nome: 'Bento Noah Carvalho', sexo: 'M' },
  { nome: 'Allana Maria Siqueira', sexo: 'F' },
  { nome: 'Henry Theo Magalhães', sexo: 'M' },
  { nome: 'Maria Valentina Barbosa', sexo: 'F' },
  { nome: 'Lorenzo Miguel Castro', sexo: 'M' },
  { nome: 'Alice Vitória Camargo', sexo: 'F' },
  { nome: 'Murilo Emanuel Pádua', sexo: 'M' },
  { nome: 'Sophie Manuela Xavier', sexo: 'F' },
  { nome: 'Gustavo Henrique Sales', sexo: 'M' },
  { nome: 'Emanuelly Rosa Pinho', sexo: 'F' },
  { nome: 'Nicolas Davi Falcão', sexo: 'M' },
  { nome: 'Melissa Júlia Amaral', sexo: 'F' },
  { nome: 'Caio Augusto Bentes', sexo: 'M' },
  { nome: 'Esther Lívia Queiroz', sexo: 'F' },
  { nome: 'Bryan Gabriel Toscano', sexo: 'M' },
];

// ---------------------------------------------------------------------------
// Montagem do elenco (ordem/índices estáveis — ver cabeçalho)
// ---------------------------------------------------------------------------

function entrada(
  indice: number,
  id: string,
  nome: string,
  papel: Papel,
  paleta: PaletaPersonagem,
  sexo: Sexo,
  extra?: { materia?: string; salaId?: string },
): PersonagemInfo {
  return { id, indice, nome, papel, sexo, paleta, ...extra };
}

export const ROSTER: PersonagemInfo[] = [
  entrada(0, 'diretora-1', 'Heloísa Martins Ribeiro', 'DIRETORA', paletaAdulto(0, '#b03a2e'), 'F'),
  entrada(1, 'secretario-1', 'Célio Andrade Nogueira', 'SECRETARIO', paletaAdulto(1, '#5b8fd6'), 'M'),

  // 12 professores (índices 2–13)
  ...PROFESSORES.map((p, i) =>
    entrada(2 + i, `prof-${i + 1}`, p.nome, 'PROFESSOR', paletaAdulto(2 + i), p.sexo, {
      materia: p.materia,
      salaId: `sala-${i + 1}`,
    }),
  ),

  // 60 alunos (índices 14–73; 5 por sala)
  ...ALUNOS.map((a, i) =>
    entrada(14 + i, `aluno-${i + 1}`, a.nome, 'ALUNO', paletaAluno(i), a.sexo, {
      salaId: `sala-${Math.floor(i / 5) + 1}`,
    }),
  ),

  // Equipe de apoio (índices 74–78)
  entrada(74, 'coz-1', 'Cleusa Aparecida Ramos', 'COZINHEIRA', paletaAdulto(14, '#f5f5f0'), 'F'),
  entrada(75, 'coz-2', 'Iracema Souza Pinto', 'COZINHEIRA', paletaAdulto(15, '#f5f5f0'), 'F'),
  entrada(76, 'fax-1', 'Sebastião Ferreira Luz', 'FAXINEIRO', paletaAdulto(16, '#7fb7d9'), 'M'),
  entrada(77, 'fax-2', 'Márcia Regina Tavares', 'FAXINEIRO', paletaAdulto(17, '#7fb7d9'), 'F'),
  entrada(78, 'porteiro-1', 'Joaquim Benedito Silva', 'PORTEIRO', paletaAdulto(18, '#4a6fa5'), 'M'),
];

// Checagem de sanidade em tempo de módulo (falha rápida se alguém editar errado).
if (ROSTER.length !== 79) {
  throw new Error(`ROSTER deve ter exatamente 79 personagens (encontrados ${ROSTER.length}).`);
}
if (new Set(ROSTER.map((p) => p.id)).size !== ROSTER.length) {
  throw new Error('ROSTER contém ids duplicados.');
}
if (new Set(ROSTER.map((p) => p.nome)).size !== ROSTER.length) {
  throw new Error('ROSTER contém nomes duplicados.');
}

/** Busca um personagem pelo id estável. */
export function getPersonagem(id: string): PersonagemInfo {
  const p = ROSTER.find((r) => r.id === id);
  if (!p) throw new Error(`Personagem desconhecido: ${id}`);
  return p;
}
