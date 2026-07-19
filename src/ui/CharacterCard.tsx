/**
 * CharacterCard.tsx — cartão de detalhes do personagem selecionado, fixo no
 * canto inferior direito (componente DOM comum, montado FORA do <Canvas>).
 * Renderiza apenas quando `selecionadoId` não é nulo.
 */

import { ROSTER } from '../contracts/roster';
import type { PersonagemInfo } from '../contracts/types';
import { useSchoolStore } from '../state/useSchoolStore';
import './ui.css';

/** Função formatada em PT-BR, ex.: "Professor(a) de Matemática". */
function funcaoDe(p: PersonagemInfo): string {
  switch (p.papel) {
    case 'DIRETORA':
      return 'Diretora';
    case 'SECRETARIO':
      return 'Secretário';
    case 'PROFESSOR':
      return p.materia ? `Professor(a) de ${p.materia}` : 'Professor(a)';
    case 'ALUNO':
      return p.salaId ? `Aluno(a) — Sala ${p.salaId.replace('sala-', '')}` : 'Aluno(a)';
    case 'COZINHEIRA':
      return 'Cozinheira';
    case 'FAXINEIRO':
      return 'Faxineiro(a)';
    case 'PORTEIRO':
      return 'Porteiro';
    default:
      return 'Equipe';
  }
}

export function CharacterCard() {
  const selecionadoId = useSchoolStore((s) => s.selecionadoId);
  const atividades = useSchoolStore((s) => s.atividades);
  const selecionar = useSchoolStore((s) => s.selecionar);

  if (!selecionadoId) return null;
  const p = ROSTER.find((r) => r.id === selecionadoId);
  if (!p) return null; // id desconhecido (defensivo)

  const atividade = atividades[p.id];

  return (
    <div className="card-personagem">
      <div className="card-cabecalho">
        <h3 className="card-nome">{p.nome}</h3>
        <button
          type="button"
          className="card-fechar"
          onClick={() => selecionar(null)}
          title="Fechar"
          aria-label="Fechar detalhes"
        >
          ✕
        </button>
      </div>
      <p className="card-funcao">{funcaoDe(p)}</p>
      {p.materia && (
        <p className="card-linha">
          <span className="rotulo">Matéria: </span>
          {p.materia}
        </p>
      )}
      <div className="card-agora">
        <span className="rotulo">Agora: </span>
        {atividade ?? '…'}
      </div>
    </div>
  );
}
