/**
 * roster.ts — ELENCO COMPLETO: exatamente 712 personagens (expansão escola em U).
 *
 * Ordem estável dos índices (0–711), usada nos buffers de simulação (SIM):
 * - 0: DIRETORA · 1: SECRETARIO
 * - 2–65: PROFESSORES (prof-1…prof-64, DOIS por sala, sala-1…sala-32;
 *   a sala k tem os profs de índices 2+2(k−1) e 2+2(k−1)+1, cada um com matéria)
 * - 66–705: ALUNOS (aluno-1…aluno-640, 20 por sala;
 *   aluno de índice i pertence a `sala-${⌊(i−66)/20⌋+1}`)
 * - 706–707: COZINHEIRAS · 708–709: FAXINEIROS · 710: PORTEIRO
 * - 711: ALMOXARIFE (papel novo 'almoxarife', paleta adulto — funcionário
 *   exclusivo do almoxarifado do Bloco C, ver SPEC)
 *
 * Somente a turma do turno atual fica no campus; os 640 slots de alunos são
 * reutilizados entre os 3 turnos (KISS — ver SPEC, seção Rotina).
 *
 * As paletas são geradas deterministicamente a partir de listas de tons com
 * passos de rotação diferentes, garantindo combinações distintas por personagem.
 * Nomes também são determinísticos: os 12 professores e os 60 alunos originais
 * foram mantidos (mesmos nomes/sexo, novos índices); os demais são gerados por
 * combinação indexada de listas de nomes próprios e sobrenomes (sem RNG).
 *
 * EDIÇÕES DE CONTRATO AUTORIZADAS (melhoria de realismo dos NPCs):
 * 1. Cada entrada tem `sexo: 'M' | 'F'`, atribuído nome a nome (nos trechos
 *    gerados, alterna F/M de forma determinística).
 * 2. Listas PELES e CABELOS ampliadas (mais tons de pele e de cabelo).
 *
 * EDIÇÃO DE CONTRATO (expansão 712): papel 'almoxarife' adicionado ao tipo
 * `Papel` em types.ts — valor em minúsculas, conforme a SPEC (seção Roster).
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
// Professores: 64 no total (2 por sala, salas 1–32).
// Os 12 originais foram mantidos; os 52 restantes são gerados deterministicamente
// (nome único por combinação indexada — ver montarProfessores()).
// ---------------------------------------------------------------------------

const PROFESSORES_ORIGINAIS: { nome: string; materia: string; sexo: Sexo }[] = [
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

// Matérias em rotação para os professores gerados (mesma lista dos originais).
const MATERIAS = PROFESSORES_ORIGINAIS.map((p) => p.materia);

// Nomes próprios dos professores gerados (26 por sexo; todos distintos entre si
// e dos nomes dos alunos/adultos gerados — os sobrenomes também são de listas
// exclusivas, então o nome completo nunca colide com os demais papéis).
const PROF_NOMES_F = [
  'Adriana', 'Aline', 'Amanda', 'Carla', 'Cristina', 'Dalva', 'Denise',
  'Eliane', 'Fabiana', 'Gisele', 'Helena', 'Ingrid', 'Jaqueline', 'Kátia',
  'Letícia', 'Luciana', 'Mônica', 'Nádia', 'Patrícia', 'Renata', 'Sabrina',
  'Tânia', 'Vânia', 'Wanda', 'Zilda', 'Priscila',
];
const PROF_NOMES_M = [
  'Alexandre', 'Bruno', 'Cássio', 'Daniel', 'Elias', 'Fábio', 'Gerson',
  'Hugo', 'Ivan', 'Jonas', 'Kleber', 'Leandro', 'Márcio', 'Nelson',
  'Osvaldo', 'Pablo', 'Quintino', 'Roberto', 'Sandro', 'Tiago', 'Ubiratan',
  'Vicente', 'William', 'Xavier', 'Yuri', 'Zaqueu',
];
// Sobrenomes exclusivos dos professores gerados (disjuntos dos dos alunos).
const PROF_SOBRENOMES_A = [
  'Castellani', 'Dourado', 'Esteves', 'Fontenele', 'Galvão', 'Hespanhol',
  'Ibiapina', 'Jardim', 'Kfouri', 'Leitão', 'Madeira', 'Noronha', 'Passos',
];
const PROF_SOBRENOMES_B = [
  'Queiroga', 'Rangel', 'Teixeira', 'Uchôa', 'Varela', 'Wanderley',
  'Ximenes', 'Yared', 'Zanetti', 'Beltrão',
];

/** Lista final dos 64 professores, em ordem estável (prof-1…prof-64). */
function montarProfessores(): { nome: string; materia: string; sexo: Sexo }[] {
  const lista = [...PROFESSORES_ORIGINAIS];
  for (let jj = 0; jj < 64 - PROFESSORES_ORIGINAIS.length; jj++) {
    const sexo: Sexo = jj % 2 === 0 ? 'F' : 'M';
    const kk = Math.floor(jj / 2); // 0–25 dentro do sexo
    const nome = sexo === 'F'
      ? `${pick(PROF_NOMES_F, kk)} ${pick(PROF_SOBRENOMES_A, kk * 3 + 1)} ${pick(PROF_SOBRENOMES_B, kk * 5 + 2)}`
      : `${pick(PROF_NOMES_M, kk)} ${pick(PROF_SOBRENOMES_A, kk * 3 + 4)} ${pick(PROF_SOBRENOMES_B, kk * 5 + 7)}`;
    lista.push({ nome, materia: pick(MATERIAS, PROFESSORES_ORIGINAIS.length + jj), sexo });
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Alunos: 640 no total (20 por sala, salas 1–32).
// Os 60 originais foram mantidos; os 580 restantes são gerados deterministicamente
// (ver montarAlunos()): sexo alterna F/M e o par (nome, sobrenome A) é único
// por índice dentro de cada sexo.
// ---------------------------------------------------------------------------

const ALUNOS_ORIGINAIS: { nome: string; sexo: Sexo }[] = [
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

// Nomes próprios dos alunos gerados (32 por sexo → 32×14 = 448 combinações
// (nome, sobrenome A) por sexo, de sobra para os 290 necessários).
const ALUNO_NOMES_F = [
  'Aurora', 'Helena', 'Catarina', 'Lívia', 'Beatriz', 'Clara', 'Marina',
  'Luísa', 'Antônia', 'Débora', 'Elisa', 'Fernanda', 'Gabriela', 'Isadora',
  'Júlia', 'Larissa', 'Maitê', 'Natália', 'Olívia', 'Pietra', 'Rafaela',
  'Sara', 'Tainá', 'Ursula', 'Vitória', 'Yasmin', 'Zuleica', 'Bruna',
  'Camila', 'Daniela', 'Eduarda', 'Flávia',
];
const ALUNO_NOMES_M = [
  'Miguel', 'Arthur', 'Heitor', 'Gael', 'Davi', 'Bernardo', 'Samuel',
  'João', 'Pedro', 'Lucas', 'Matheus', 'Gustavo', 'Rafael', 'Felipe',
  'Daniel', 'Bruno', 'Eduardo', 'Leonardo', 'Rodrigo', 'Marcelo', 'Thiago',
  'Caio', 'Igor', 'Vinícius', 'André', 'Fábio', 'Leandro', 'Otávio',
  'Renan', 'Ítalo', 'Kaique', 'Emanuel',
];
// Sobrenomes dos alunos gerados (disjuntos dos dos professores gerados).
const ALUNO_SOBRENOMES_A = [
  'Albuquerque', 'Barroso', 'Castilho', 'Drummond', 'Espíndola', 'Fagundes',
  'Gusmão', 'Holanda', 'Junqueira', 'Lacerda', 'Mascarenhas', 'Navarro',
  'Quintana', 'Sarmento',
];
const ALUNO_SOBRENOMES_B = [
  'Peixoto', 'Rezende', 'Valadares', 'Figueiredo', 'Sampaio', 'Vasques',
  'Guimarães', 'Bentes', 'Toscano', 'Sales',
];

/** Lista final dos 640 alunos, em ordem estável (aluno-1…aluno-640). */
function montarAlunos(): { nome: string; sexo: Sexo }[] {
  const lista = [...ALUNOS_ORIGINAIS];
  for (let jj = 0; jj < 640 - ALUNOS_ORIGINAIS.length; jj++) {
    const sexo: Sexo = jj % 2 === 0 ? 'F' : 'M';
    const kk = Math.floor(jj / 2); // 0–289 dentro do sexo
    const nome = sexo === 'F'
      ? `${pick(ALUNO_NOMES_F, kk % 32)} ${pick(ALUNO_SOBRENOMES_A, Math.floor(kk / 32))} ${pick(ALUNO_SOBRENOMES_B, kk * 7 + 3)}`
      : `${pick(ALUNO_NOMES_M, kk % 32)} ${pick(ALUNO_SOBRENOMES_A, Math.floor(kk / 32))} ${pick(ALUNO_SOBRENOMES_B, kk * 7 + 5)}`;
    lista.push({ nome, sexo });
  }
  return lista;
}

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

const PROFESSORES = montarProfessores();
const ALUNOS = montarAlunos();

export const ROSTER: PersonagemInfo[] = [
  entrada(0, 'diretora-1', 'Heloísa Martins Ribeiro', 'DIRETORA', paletaAdulto(0, '#b03a2e'), 'F'),
  entrada(1, 'secretario-1', 'Célio Andrade Nogueira', 'SECRETARIO', paletaAdulto(1, '#5b8fd6'), 'M'),

  // 64 professores (índices 2–65; sala k = profs 2+2(k−1) e 2+2(k−1)+1)
  ...PROFESSORES.map((p, i) =>
    entrada(2 + i, `prof-${i + 1}`, p.nome, 'PROFESSOR', paletaAdulto(2 + i), p.sexo, {
      materia: p.materia,
      salaId: `sala-${Math.floor(i / 2) + 1}`,
    }),
  ),

  // 640 alunos (índices 66–705; 20 por sala)
  ...ALUNOS.map((a, i) =>
    entrada(66 + i, `aluno-${i + 1}`, a.nome, 'ALUNO', paletaAluno(i), a.sexo, {
      salaId: `sala-${Math.floor(i / 20) + 1}`,
    }),
  ),

  // Equipe de apoio (índices 706–711)
  entrada(706, 'coz-1', 'Cleusa Aparecida Ramos', 'COZINHEIRA', paletaAdulto(14, '#f5f5f0'), 'F'),
  entrada(707, 'coz-2', 'Iracema Souza Pinto', 'COZINHEIRA', paletaAdulto(15, '#f5f5f0'), 'F'),
  entrada(708, 'fax-1', 'Sebastião Ferreira Luz', 'FAXINEIRO', paletaAdulto(16, '#7fb7d9'), 'M'),
  entrada(709, 'fax-2', 'Márcia Regina Tavares', 'FAXINEIRO', paletaAdulto(17, '#7fb7d9'), 'F'),
  entrada(710, 'porteiro-1', 'Joaquim Benedito Silva', 'PORTEIRO', paletaAdulto(18, '#4a6fa5'), 'M'),
  entrada(711, 'almoxarife-1', 'Genaro Batista Lemos', 'almoxarife', paletaAdulto(19, '#8d6e63'), 'M'),
];

// Checagens de sanidade em tempo de módulo (falha rápida se alguém editar errado).
if (ROSTER.length !== 712) {
  throw new Error(`ROSTER deve ter exatamente 712 personagens (encontrados ${ROSTER.length}).`);
}
if (new Set(ROSTER.map((p) => p.id)).size !== ROSTER.length) {
  throw new Error('ROSTER contém ids duplicados.');
}
if (new Set(ROSTER.map((p) => p.nome)).size !== ROSTER.length) {
  throw new Error('ROSTER contém nomes duplicados.');
}
if (!ROSTER.every((p, i) => p.indice === i)) {
  throw new Error('ROSTER contém índices fora da ordem estável 0–711.');
}

/** Busca um personagem pelo id estável. */
export function getPersonagem(id: string): PersonagemInfo {
  const p = ROSTER.find((r) => r.id === id);
  if (!p) throw new Error(`Personagem desconhecido: ${id}`);
  return p;
}
