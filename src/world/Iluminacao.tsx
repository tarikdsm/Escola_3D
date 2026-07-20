/**
 * Iluminacao.tsx — Ciclo de iluminação dia/noite da escola (frente W8).
 *
 * Substitui o bloco de luz fixo que hoje vive no App.tsx. Lê o relógio do
 * jogo DENTRO de useFrame via `useSchoolStore.getState().clockMin` (sem
 * subscribe — clockMin muda por frame e re-renderizaria o componente) e
 * interpola suavemente, por lerp linear entre marcos do dia:
 *
 *   - posição / intensidade / cor da luz direcional principal (sol de dia,
 *     "lua" fraca e azulada à noite), MANTENDO as mesmas props de sombra do
 *     bloco antigo do App.tsx (map 2048, frustum ±95 cobrindo o terreno);
 *   - cor de fundo do céu (<color attach="background"> mutada por ref) e fog;
 *   - luz hemisférica (céu/gramado) — a "ambiente" da cena;
 *   - à noite: 4 holofotes (spotlights) sobre a quadra (cantos de QUADRA.rect,
 *     mirando QUADRA.centro) + 1 point light sobre a guarita/portão (PORTARIA).
 *
 * Faixas (minutos do dia): 7h alvorada quente e fraca → 9h–16h sol pleno →
 * 17h–18h30 dourado de fim de tarde → 19h+ noite (céu #0b1026, lua azulada,
 * ambiente baixo, holofotes ligados). Os marcos cobrem 0h–24h, então qualquer
 * valor de clockMin (inclusive depuração fora do 7h–23h) é amostrado sem salto.
 *
 * PERFORMANCE: zero alocação por frame — os marcos são THREE.Color pré-
 * construídos no módulo e o loop só faz copy/lerp em refs. Os holofotes e a
 * luz do portão NUNCA são desmontados nem têm `visible` alternado: mudar o
 * NÚMERO de luzes na cena força recompilação de shader em todos os materiais
 * (tranco visível); em vez disso, só a intensidade vai a 0 durante o dia.
 * `decay={0}` nos pontos/spotlights deixa a intensidade em escala "clássica"
 * (1.0 = cheio), independente das unidades físicas do three r169.
 *
 * INTEGRAÇÃO (fase 3): montar `<Iluminacao />` DENTRO do <Canvas> do App.tsx
 * (usa useFrame e attach="background"/"fog" na cena), no lugar das linhas
 * `<color attach="background">`, `<fog>`, `<hemisphereLight>` e
 * `<directionalLight>` fixas. Sem props — tudo deriva dos contratos e da store.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PALETTE, PORTARIA, QUADRA } from '../contracts';
import type { Vec3 } from '../contracts';
import { useSchoolStore } from '../state/useSchoolStore';

// ---------------------------------------------------------------------------
// Marcos do dia — a curva de iluminação é o lerp linear entre marcos vizinhos
// ---------------------------------------------------------------------------

/** Um ponto da curva diária de luz. Cores pré-construídas (sem alocação no loop). */
interface Marco {
  /** Minuto do dia (0–1440). */
  min: number;
  /** Posição da direcional (sol de dia, lua à noite — olha para a origem). */
  solPos: Vec3;
  solInt: number;
  solCor: THREE.Color;
  /** Cor do céu (fundo) e do fog (mesma tonalidade, como no bloco antigo). */
  ceu: THREE.Color;
  fogPerto: number;
  fogLonge: number;
  /** Hemisférica: cor do céu, cor do chão e intensidade. */
  hemiCeu: THREE.Color;
  hemiChao: THREE.Color;
  hemiInt: number;
  /** Fator 0–1 das luzes noturnas (holofotes da quadra + luz do portão). */
  noturna: number;
}

const cor = (hex: string) => new THREE.Color(hex);

/** Parâmetros da noite, reutilizados nos marcos 0h / 6h / 19h / 24h. */
const NOITE = {
  solPos: [-50, 80, -40] as Vec3, // "lua" alta, azulada
  solInt: 0.25,
  solCor: cor('#a9c0ff'),
  ceu: cor('#0b1026'), // azul-escuro da spec
  fogPerto: 140,
  fogLonge: 460,
  hemiCeu: cor('#25335a'),
  hemiChao: cor('#18231a'),
  hemiInt: 0.28, // ambiente baixo
  noturna: 1,
};

/** Marcos ordenados por minuto; o último (24h) repete o primeiro p/ o wrap. */
const MARCOS: Marco[] = [
  { min: 0, ...NOITE },
  { min: 360, ...NOITE }, // 6h — ainda noite fechada
  {
    // 7h — ALVORADA: sol baixo a leste (+x), quente e fraco.
    min: 420,
    solPos: [110, 14, -10],
    solInt: 0.7,
    solCor: cor('#ffcf9e'),
    ceu: cor('#e8b28a'),
    fogPerto: 200,
    fogLonge: 520,
    hemiCeu: cor('#ffd9b8'),
    hemiChao: cor('#7a9a58'),
    hemiInt: 0.5,
    noturna: 0, // holofotes apagam entre 6h e 7h
  },
  {
    // 9h — SOL PLENO da manhã.
    min: 540,
    solPos: [90, 70, 15],
    solInt: 1.5,
    solCor: cor(PALETTE.sol),
    ceu: cor(PALETTE.ceu),
    fogPerto: 200,
    fogLonge: 520,
    hemiCeu: cor('#cfe5ff'),
    hemiChao: cor('#7a9a58'),
    hemiInt: 0.75,
    noturna: 0,
  },
  {
    // 12h — sol a pino: exatamente os valores do bloco fixo antigo do App.tsx.
    min: 720,
    solPos: [65, 90, 45],
    solInt: 1.6,
    solCor: cor(PALETTE.sol),
    ceu: cor(PALETTE.ceu),
    fogPerto: 200,
    fogLonge: 520,
    hemiCeu: cor('#cfe5ff'),
    hemiChao: cor('#7a9a58'),
    hemiInt: 0.75,
    noturna: 0,
  },
  {
    // 16h — SOL PLENO da tarde, já descendo para oeste (−x).
    min: 960,
    solPos: [-20, 78, 55],
    solInt: 1.5,
    solCor: cor('#ffedc8'),
    ceu: cor(PALETTE.ceu),
    fogPerto: 200,
    fogLonge: 520,
    hemiCeu: cor('#cfe5ff'),
    hemiChao: cor('#7a9a58'),
    hemiInt: 0.75,
    noturna: 0,
  },
  {
    // 17h — DOURADO de fim de tarde: sol baixo a oeste, luz alaranjada.
    min: 1020,
    solPos: [-80, 28, 40],
    solInt: 1.0,
    solCor: cor('#ffb877'),
    ceu: cor('#d9a077'),
    fogPerto: 190,
    fogLonge: 500,
    hemiCeu: cor('#e8c39a'),
    hemiChao: cor('#6b7a4a'),
    hemiInt: 0.55,
    noturna: 0,
  },
  {
    // 18h30 — CREPÚSCULO: sol rente ao horizonte, céu arroxeado escurecendo.
    min: 1110,
    solPos: [-115, 9, 25],
    solInt: 0.35,
    solCor: cor('#ff8e5e'),
    ceu: cor('#4a3a5e'),
    fogPerto: 160,
    fogLonge: 470,
    hemiCeu: cor('#6a5a8a'),
    hemiChao: cor('#2a3320'),
    hemiInt: 0.35,
    noturna: 0, // holofotes acendem no trecho 18h30 → 19h
  },
  { min: 1140, ...NOITE }, // 19h — NOITE
  { min: 1440, ...NOITE }, // 24h — igual a 0h (wrap suave)
];

/** Lerp linear entre dois escalares. */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/** Intensidade-cheia (fator noturna = 1) das luzes artificiais. */
const INT_HOLOFOTE = 1.8;
const INT_PORTAO = 1.0;

export function Iluminacao() {
  const solRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ceuRef = useRef<THREE.Color>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const portaoRef = useRef<THREE.PointLight>(null);
  const holofotesRef = useRef<(THREE.SpotLight | null)[]>([]);

  // Alvo único dos holofotes: o centro da quadra. Precisa estar na cena
  // (<primitive>) para o matrixWorld atualizar e o spotlight apontar certo.
  const alvoQuadra = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(QUADRA.centro[0], QUADRA.centro[1], QUADRA.centro[2]);
    return o;
  }, []);

  // Torres de holofote nos 4 cantos da quadra (derivadas de QUADRA.rect),
  // a 10 m de altura — acima do alambrado de 3 m, como mastros reais.
  const torres = useMemo<Vec3[]>(() => {
    const { x, z, w, d } = QUADRA.rect;
    const h = 10;
    return [
      [x, h, z],
      [x + w, h, z],
      [x, h, z + d],
      [x + w, h, z + d],
    ];
  }, []);

  // Ponto de luz sobre a guarita (centro do telhado, a ~3,4 m): ilumina
  // também o vão do portão, logo ao lado (ambos de PORTARIA).
  const posLuzPortao = useMemo<Vec3>(() => {
    const g = PORTARIA.guarita;
    return [g.x + g.w / 2, 3.4, g.z + g.d / 2];
  }, []);

  useFrame(() => {
    const sol = solRef.current;
    const hemi = hemiRef.current;
    const ceu = ceuRef.current;
    const fog = fogRef.current;
    if (!sol || !hemi || !ceu || !fog) return;

    // Leitura do relógio SEM subscribe (muda por frame — ver cabeçalho).
    const min = useSchoolStore.getState().clockMin;

    // Segmento da curva: a.min <= min < b.min.
    let i = 0;
    while (i < MARCOS.length - 2 && min >= MARCOS[i + 1].min) i++;
    const a = MARCOS[i];
    const b = MARCOS[i + 1];
    const t = Math.min(1, Math.max(0, (min - a.min) / (b.min - a.min)));

    // Direcional (sol/lua): posição, intensidade e cor.
    sol.position.set(
      lerp(a.solPos[0], b.solPos[0], t),
      lerp(a.solPos[1], b.solPos[1], t),
      lerp(a.solPos[2], b.solPos[2], t),
    );
    sol.intensity = lerp(a.solInt, b.solInt, t);
    sol.color.copy(a.solCor).lerp(b.solCor, t);

    // Céu (fundo) + fog na mesma tonalidade.
    ceu.copy(a.ceu).lerp(b.ceu, t);
    fog.color.copy(ceu);
    fog.near = lerp(a.fogPerto, b.fogPerto, t);
    fog.far = lerp(a.fogLonge, b.fogLonge, t);

    // Hemisférica (ambiente céu/gramado).
    hemi.color.copy(a.hemiCeu).lerp(b.hemiCeu, t);
    hemi.groundColor.copy(a.hemiChao).lerp(b.hemiChao, t);
    hemi.intensity = lerp(a.hemiInt, b.hemiInt, t);

    // Luzes noturnas: mesmo fator 0–1 p/ holofotes e portão. Intensidade a 0
    // de dia (sem desmontar — recompilaria shaders; ver cabeçalho).
    const n = lerp(a.noturna, b.noturna, t);
    for (let k = 0; k < holofotesRef.current.length; k++) {
      const h = holofotesRef.current[k];
      if (h) h.intensity = INT_HOLOFOTE * n;
    }
    if (portaoRef.current) portaoRef.current.intensity = INT_PORTAO * n;
  });

  return (
    <>
      {/* Céu: cor de fundo + fog (valores iniciais = dia; o useFrame regrava). */}
      <color ref={ceuRef} attach="background" args={[PALETTE.ceu]} />
      <fog ref={fogRef} attach="fog" args={[PALETTE.ceu, 200, 520]} />

      {/* Luz ambiente de céu/gramado (interpola ao longo do dia). */}
      <hemisphereLight ref={hemiRef} args={['#cfe5ff', '#7a9a58', 0.75]} />

      {/* Sol/lua — MESMAS props de sombra do bloco fixo antigo do App.tsx
          (map 2048, frustum ±95 cobrindo o terreno inteiro, ~±90 m). */}
      <directionalLight
        ref={solRef}
        position={[65, 90, 45]}
        intensity={1.6}
        color={PALETTE.sol}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-95}
        shadow-camera-right={95}
        shadow-camera-top={95}
        shadow-camera-bottom={-95}
        shadow-camera-near={10}
        shadow-camera-far={320}
        shadow-bias={-0.0002}
        shadow-normalBias={0.5}
      />

      {/* Holofotes da quadra (só acendem à noite; alvo = centro da quadra). */}
      <primitive object={alvoQuadra} />
      {torres.map((p, k) => (
        <spotLight
          key={k}
          ref={(el) => {
            holofotesRef.current[k] = el;
          }}
          position={p}
          target={alvoQuadra}
          angle={0.7}
          penumbra={0.6}
          decay={0}
          distance={0}
          intensity={0}
          color="#e8f0ff"
        />
      ))}

      {/* Luz do portão/guarita (quente, alcance curto). */}
      <pointLight
        ref={portaoRef}
        position={posLuzPortao}
        decay={0}
        distance={16}
        intensity={0}
        color="#ffd9a0"
      />
    </>
  );
}
