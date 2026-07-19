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
 */

import type { PaletaPersonagem, Papel, PersonagemInfo } from './types';

// ---------------------------------------------------------------------------
// Listas de tons (hex) usadas na composição das paletas
// ---------------------------------------------------------------------------

const PELES = ['#8d5524', '#a0663a', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];
const CABELOS = ['#1b1210', '#2e1f16', '#4a2c14', '#6b3f1d', '#8a5a2b', '#3b3b3b', '#111111', '#5b3a1e'];
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
// Professores (um por sala 1–12, matérias variadas)
// ---------------------------------------------------------------------------

const PROFESSORES: { nome: string; materia: string }[] = [
  { nome: 'Mariana Souza Freitas', materia: 'Português' },
  { nome: 'Ricardo Almeida Prado', materia: 'Matemática' },
  { nome: 'José Carlos Bandeira', materia: 'História' },
  { nome: 'Fernanda Lima Peixoto', materia: 'Geografia' },
  { nome: 'Paulo Henrique Rezende', materia: 'Ciências' },
  { nome: 'Juliana Castro Brito', materia: 'Inglês' },
  { nome: 'Tatiane Rocha Valadares', materia: 'Artes' },
  { nome: 'Marcelo Dias Figueiredo', materia: 'Educação Física' },
  { nome: 'André Luiz Sampaio', materia: 'Física' },
  { nome: 'Beatriz Nogueira Sales', materia: 'Química' },
  { nome: 'Camila Torres Vasques', materia: 'Biologia' },
  { nome: 'Sérgio Moura Guimarães', materia: 'Redação/Literatura' },
];

// ---------------------------------------------------------------------------
// Alunos (60 nomes; sala = índice ÷ 5 + 1)
// ---------------------------------------------------------------------------

const ALUNOS: string[] = [
  'Ana Clara Mendes',
  'Pedro Henrique Lopes',
  'Maria Eduarda Santos',
  'João Pedro Oliveira',
  'Laura Beatriz Rocha',
  'Gabriel Lucas Ferreira',
  'Sofia Almeida Cruz',
  'Miguel Arthur Ramos',
  'Isabella Vitória Pires',
  'Arthur Miguel Barros',
  'Alice Gabriela Morais',
  'Lucas Emanuel Teles',
  'Manuela Cecília Braga',
  'Rafael Augusto Pinto',
  'Heloísa Maria Campos',
  'Enzo Gabriel Ribeiro',
  'Valentina Alice Nunes',
  'Theo Nicolas Azevedo',
  'Júlia Emília Cardoso',
  'Bernardo Isaac Moura',
  'Cecília Rosa Farias',
  'Davi Lucca Moreira',
  'Antonella Maria Cunha',
  'Samuel Levi Correia',
  'Eloá Sophia Gonçalves',
  'Caleb Benício Duarte',
  'Lara Isabel Fogaça',
  'Anthony Gabriel Sales',
  'Maria Júlia Peçanha',
  'Levi Enrico Barreto',
  'Giovanna Lara Mota',
  'Benedito Caio Novaes',
  'Yasmin Vitória Lins',
  'Kauã Miguel Serra',
  'Maria Alice Tavares',
  'Ravi Lucca Vasquez',
  'Agatha Beatriz Leão',
  'Noah William Pacheco',
  'Maria Cecília Fontes',
  'Joaquim Pedro Saldanha',
  'Clarice Helena Bastos',
  'Otto Gabriel Furtado',
  'Marina Sofia Quintela',
  'Vicente Arthur Lemos',
  'Isabelly Nicole Reis',
  'Bento Noah Carvalho',
  'Allana Maria Siqueira',
  'Henry Theo Magalhães',
  'Maria Valentina Barbosa',
  'Lorenzo Miguel Castro',
  'Alice Vitória Camargo',
  'Murilo Emanuel Pádua',
  'Sophie Manuela Xavier',
  'Gustavo Henrique Sales',
  'Emanuelly Rosa Pinho',
  'Nicolas Davi Falcão',
  'Melissa Júlia Amaral',
  'Caio Augusto Bentes',
  'Esther Lívia Queiroz',
  'Bryan Gabriel Toscano',
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
  extra?: { materia?: string; salaId?: string },
): PersonagemInfo {
  return { id, indice, nome, papel, paleta, ...extra };
}

export const ROSTER: PersonagemInfo[] = [
  entrada(0, 'diretora-1', 'Heloísa Martins Ribeiro', 'DIRETORA', paletaAdulto(0, '#b03a2e')),
  entrada(1, 'secretario-1', 'Célio Andrade Nogueira', 'SECRETARIO', paletaAdulto(1, '#5b8fd6')),

  // 12 professores (índices 2–13)
  ...PROFESSORES.map((p, i) =>
    entrada(2 + i, `prof-${i + 1}`, p.nome, 'PROFESSOR', paletaAdulto(2 + i), {
      materia: p.materia,
      salaId: `sala-${i + 1}`,
    }),
  ),

  // 60 alunos (índices 14–73; 5 por sala)
  ...ALUNOS.map((nome, i) =>
    entrada(14 + i, `aluno-${i + 1}`, nome, 'ALUNO', paletaAluno(i), {
      salaId: `sala-${Math.floor(i / 5) + 1}`,
    }),
  ),

  // Equipe de apoio (índices 74–78)
  entrada(74, 'coz-1', 'Cleusa Aparecida Ramos', 'COZINHEIRA', paletaAdulto(14, '#f5f5f0')),
  entrada(75, 'coz-2', 'Iracema Souza Pinto', 'COZINHEIRA', paletaAdulto(15, '#f5f5f0')),
  entrada(76, 'fax-1', 'Sebastião Ferreira Luz', 'FAXINEIRO', paletaAdulto(16, '#7fb7d9')),
  entrada(77, 'fax-2', 'Márcia Regina Tavares', 'FAXINEIRO', paletaAdulto(17, '#7fb7d9')),
  entrada(78, 'porteiro-1', 'Joaquim Benedito Silva', 'PORTEIRO', paletaAdulto(18, '#4a6fa5')),
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
