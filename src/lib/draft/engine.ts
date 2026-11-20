/**
 * IDrafty strategy engine — pure, deterministic functions. No React here.
 *
 * SCORING MODEL (all components normalized to 0..1, final = weighted mean × 100):
 *  - matchup  (40%): mean of candidate-vs-enemy scores (-5..+5, unknown = 0),
 *                    minus a RISK PENALTY when the worst matchup is ≤ -2:
 *                    penalty = (|worst| - 1) × RISK_PENALTY. Then (x+5)/10.
 *                    The penalty lives ONLY here, so a terrible matchup is not counted twice.
 *  - synergy  (10%): mean synergy with picked allies (unknown = 0), (x+3)/6.
 *  - fit      (40%): mean of mode advantage and map / terrain fit.
 *  - coverage  (5%): new role / new range band for the team.
 *  - risk      (5%): vulnerabilities the candidate STACKS with allies (shared weakness tags).
 * The 0–100 result is an ordinal strategic grade, NOT a win probability.
 */
import {
  guideMatchupKey,
  type Brawler,
  type Confidence,
  type Dataset,
  type DraftState,
  type GameMap,
  type Matchup,
  type ModeId,
} from "./types";
import {
  getDraftWarning,
  getMatchupGuideEntry,
  getGuideEntry,
  GUIDE_SCORING_RULES,
} from "@/data/strategy-guide";

export interface Weights {
  matchup: number;
  synergy: number;
  fit: number;
  coverage: number;
  risk: number;
}
export const DEFAULT_WEIGHTS: Weights = {
  matchup: 0.4,
  synergy: 0.1,
  fit: 0.4,
  coverage: 0.05,
  risk: 0.05,
};
export const RISK_PENALTY = 0.5;

const CONF_VALUE: Record<Confidence, number> = { baixa: 0.33, media: 0.66, alta: 1 };
const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const norm3 = (x: number) => clamp((x + 3) / 6);
const norm5 = (x: number) => clamp((x + 5) / 10);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export type MatchupScope = "mapa" | "modo" | "geral" | "desconhecido";
export interface MatchupLookup {
  score: number;
  known: boolean;
  scope: MatchupScope;
  entry?: Matchup;
  inverted: boolean;
}

export interface Context {
  mapId?: string | null;
  mode?: ModeId | null;
}

/** Most specific entry wins: map > mode > generic. Inverse of symmetric entries is used as fallback. */
export function getMatchup(ds: Dataset, a: string, b: string, ctx: Context = {}): MatchupLookup {
  const direct = ds.matchups.filter((m) => m.attacker === a && m.defender === b);
  const inverse = ds.matchups.filter((m) => m.attacker === b && m.defender === a && !m.asymmetric);
  const pick = (list: Matchup[]): [Matchup, MatchupScope] | null => {
    const byMap = ctx.mapId ? list.find((m) => m.mapId === ctx.mapId) : undefined;
    if (byMap) return [byMap, "mapa"];
    const byMode = ctx.mode ? list.find((m) => !m.mapId && m.mode === ctx.mode) : undefined;
    if (byMode) return [byMode, "modo"];
    const generic = list.find((m) => !m.mapId && !m.mode);
    return generic ? [generic, "geral"] : null;
  };
  const d = pick(direct);
  const i = pick(inverse);
  const rank = { mapa: 3, modo: 2, geral: 1, desconhecido: 0 };
  if (d && (!i || rank[d[1]] >= rank[i[1]]))
    return { score: d[0].score, known: true, scope: d[1], entry: d[0], inverted: false };
  if (i) return { score: -i[0].score, known: true, scope: i[1], entry: i[0], inverted: true };

  return getGuideMatchup(ds, a, b);
}

/** Matchup described by the strategy guide, independently of structured matchup records. */
export function getGuideMatchup(ds: Dataset, a: string, b: string): MatchupLookup {
  const guideA = getGuideEntry(a);
  const guideB = getGuideEntry(b);
  const reviewedA = getMatchupGuideEntry(a);
  const reviewedB = getMatchupGuideEntry(b);
  if (ds.disabledGuideMatchups?.includes(guideMatchupKey(a, b))) {
    return { score: 0, known: false, scope: "desconhecido", inverted: false };
  }
  let guideScore = 0;
  let explanation = "";
  if (reviewedA?.hardCounters.includes(b)) {
    guideScore = -5;
    explanation = `${guideB?.name ?? b} é Hard Counter de ${guideA?.name ?? a}.`;
  } else if (reviewedA?.counteredBy.includes(b)) {
    guideScore = -2;
    explanation = "O guia estratégico indica que este Brawler é counterado pelo adversário.";
  } else if (reviewedB?.hardCounters.includes(a)) {
    guideScore = 5;
    explanation = `${guideA?.name ?? a} é Hard Counter de ${guideB?.name ?? b}.`;
  } else if (reviewedB?.counteredBy.includes(a)) {
    guideScore = 2;
    explanation = "O guia estratégico indica vantagem neste confronto.";
  }

  if (guideScore !== 0) {
    const entry: Matchup = {
      attacker: a,
      defender: b,
      score: guideScore,
      explanation,
      source: "Guia estratégico de 108 Brawlers",
      confidence: "baixa",
      status: "estimativa",
      reviewed: "2026-10-29",
    };
    return { score: entry.score, known: true, scope: "geral", entry, inverted: false };
  }
  return { score: 0, known: false, scope: "desconhecido", inverted: false };
}

export function getSynergy(ds: Dataset, a: string, b: string) {
  const guideA = getGuideEntry(a);
  const guideB = getGuideEntry(b);
  if (guideA?.synergies.includes(b) || guideB?.synergies.includes(a)) {
    return {
      score: GUIDE_SCORING_RULES.teamSynergy,
      known: true,
      entry: {
        a,
        b,
        score: GUIDE_SCORING_RULES.teamSynergy,
        explanation: "Sinergia recomendada pelo guia de counters fornecido.",
        confidence: "baixa" as const,
        status: "estimativa" as const,
      },
    };
  }
  const s = ds.synergies.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  return s
    ? { score: s.score, known: true, entry: s }
    : { score: 0, known: false as const, entry: undefined };
}

export function modeFit(br: Brawler, mode?: ModeId | null) {
  if (!mode) return { value: 0.5, known: false };
  const bestModes = getGuideEntry(br.id)?.bestModes;
  if (!bestModes?.length) return { value: 0.5, known: false };
  return { value: bestModes.includes(mode) ? 1 : 0.4, known: true };
}

export function mapFit(br: Brawler, map?: GameMap | null) {
  if (!map) return { value: 0.5, known: false, specific: false };
  const highlightedMaps = getGuideEntry(br.id)?.maps;
  if (!highlightedMaps?.length) return { value: 0.5, known: false, specific: false };
  return {
    value: highlightedMaps.includes(map.id) ? 1 : 0.4,
    known: true,
    specific: highlightedMaps.includes(map.id),
  };
}

export const picked = (d: DraftState) =>
  [...d.allies, ...d.enemies].filter((x): x is string => !!x);

export interface MatchupCell {
  enemyId: string;
  score: number;
  known: boolean;
  scope: MatchupScope;
  explanation?: string | undefined;
}

export interface CandidateResult {
  id: string;
  score: number;
  components: Record<keyof Weights, number>;
  matchups: MatchupCell[];
  worst: number;
  penalty: number;
  synergyAvg: number;
  synergyNotes: string[];
  mapValue: number;
  confidence: Confidence;
  confidenceValue: number;
  /** Fraction of enemy matchups backed by an explicit matchup record (0..1). */
  matchupCoverage: number;
  positives: string[];
  risks: string[];
  strategicPoints: number;
  strategicReasons: string[];
  warning: string | null;
}

function matchupComponent(ds: Dataset, id: string, enemies: string[], ctx: Context) {
  const cells: MatchupCell[] = enemies.map((e) => {
    const r = getMatchup(ds, id, e, ctx);
    return {
      enemyId: e,
      score: r.score,
      known: r.known,
      scope: r.scope,
      explanation: r.entry?.explanation,
    };
  });
  if (!cells.length) return { value: 0.5, cells, worst: 0, penalty: 0 };
  const scores = cells.map((c) => clamp(c.score, -5, 5));
  const worst = Math.min(...scores);
  const penalty = worst <= -2 ? (-worst - 1) * RISK_PENALTY : 0;
  return { value: norm5(clamp(mean(scores) - penalty, -5, 5)), cells, worst, penalty };
}

export function scoreCandidate(
  ds: Dataset,
  id: string,
  draft: DraftState,
  weights: Weights = DEFAULT_WEIGHTS,
  allySlot?: number,
  applyLastPickPenalty = true,
): CandidateResult {
  const br = ds.brawlers.find((x) => x.id === id)!;
  const byId = (x: string) => ds.brawlers.find((y) => y.id === x)!;
  const ctx: Context = { mapId: draft.mapId, mode: draft.mode };
  const map = ds.maps.find((m) => m.id === draft.mapId) ?? null;
  const enemies = draft.enemies.filter((x): x is string => !!x);
  const allies = draft.allies.filter((x, i): x is string => !!x && x !== id && i !== allySlot);

  const mc = matchupComponent(ds, id, enemies, ctx);

  const syn = allies.map((a) => ({ a, ...getSynergy(ds, id, a) }));
  const synergyAvg = mean(syn.map((s) => s.score));
  const synergy = allies.length ? norm3(synergyAvg) : 0.5;

  const mf = modeFit(br, draft.mode);
  const mpf = mapFit(br, map);
  const fit = mean([mf.value, mpf.value]);

  const allyB = allies.map(byId);
  const newRole = !allyB.some((a) => a.role === br.role);
  const newRange = !allyB.some((a) => a.range === br.range);
  const coverage = allies.length ? clamp((newRole ? 0.7 : 0.25) + (newRange ? 0.3 : 0)) : 0.5;

  const stacked = br.weakTo.filter((t) => allyB.some((a) => a.weakTo.includes(t)));
  const risk = clamp(1 - stacked.length * 0.34);

  const components = { matchup: mc.value, synergy, fit, coverage, risk };
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const total =
    (Object.keys(weights) as (keyof Weights)[]).reduce(
      (s, k) => s + weights[k] * components[k],
      0,
    ) / wsum;

  const knownMatchups = mc.cells.filter((c) => c.known).length;
  const matchupCoverage = mc.cells.length ? knownMatchups / mc.cells.length : 0;
  const confParts = mc.cells.map((c) => {
    if (!c.known) return 0;
    const r = getMatchup(ds, id, c.enemyId, ctx);
    return CONF_VALUE[r.entry!.confidence];
  });
  // Confidence reflects both the quality of known records and how many enemy
  // matchups are actually documented. Unknown matchups remain unknown, not neutral facts.
  const confidenceValue = confParts.length ? mean(confParts) * (map ? 1 : 0.85) : 0;
  const confidence: Confidence =
    confidenceValue >= 0.7 ? "alta" : confidenceValue >= 0.4 ? "media" : "baixa";

  const name = (x: string) => byId(x).name;
  const positives: string[] = [];
  const risks: string[] = [];
  const guide = getGuideEntry(id);
  mc.cells.forEach((c) => {
    const enemyName = name(c.enemyId);
    const enemyGuide = getMatchupGuideEntry(c.enemyId);
    if (enemyGuide?.hardCounters.includes(id)) {
      positives.push(`${br.name} é Hard Counter de ${enemyName}`);
    } else if (guide?.hardCounters.includes(c.enemyId)) {
      risks.push(`${enemyName} é Hard Counter de ${br.name}`);
    } else if (c.score >= 2) positives.push(`Vantagem forte contra ${enemyName}`);
    else if (c.score <= -2) risks.push(`Desvantagem forte contra ${enemyName}`);
    else if (!c.known)
      risks.push(`Sem dados de matchup contra ${name(c.enemyId)} (tratado como neutro)`);
  });
  syn.forEach((s) => {
    if (s.score >= 1) positives.push(`Sinergia com ${name(s.a)}: ${s.entry!.explanation}`);
    if (s.score <= -1) risks.push(`Sinergia ruim com ${name(s.a)}: ${s.entry!.explanation}`);
  });
  if (draft.mode && mf.value === 1) positives.push("Bom no modo de jogo");
  if (map && mpf.value >= 0.75) positives.push(`Terreno favorável em ${map.name}`);
  if (map && mpf.value <= 0.3) risks.push(`Terreno desfavorável em ${map.name}`);
  if (allies.length && newRole) positives.push(`Adiciona a função ${br.role} à equipe`);
  if (stacked.length)
    risks.push(`Acumula fraquezas da equipe: ${stacked.join(", ").replaceAll("_", " ")}`);

  // Explicit point rules from the user's 108-brawler guide are layered on top
  // of the existing 0–100 model; the result remains a strategic grade, not win probability.
  let strategicPoints = 0;
  const strategicReasons: string[] = [];
  const strategicPositives: string[] = [];
  const strategicRisks: string[] = [];
  const warning = getDraftWarning(id, br.role, br.range);
  const isMeta = br.meta ?? guide?.meta;
  const isSubMeta = br.subMeta ?? guide?.subMeta;
  if (isMeta) {
    strategicPoints += GUIDE_SCORING_RULES.meta;
    strategicReasons.push("🌟 META");
    strategicPositives.push("🌟 META");
  } else if (isSubMeta) {
    strategicPoints += GUIDE_SCORING_RULES.subMeta;
    strategicReasons.push("✨ Sub-Meta");
    strategicPositives.push("✨ Sub-Meta");
  }
  if (guide?.support) {
    strategicPoints += GUIDE_SCORING_RULES.support;
    strategicReasons.push("Suporte à equipe");
    strategicPositives.push("Suporte à equipe");
  }
  if (map && guide?.maps.includes(map.id)) {
    strategicPoints += GUIDE_SCORING_RULES.mapHighlight;
    strategicReasons.push(`Destaque no mapa ${map.name}`);
    strategicPositives.push(`Destaque no mapa ${map.name}`);
  }
  if (map && guide?.worstMaps.includes(map.id)) {
    strategicPoints += GUIDE_SCORING_RULES.worstMap;
    strategicReasons.push(`Mapa desfavorável: ${map.name}`);
    strategicRisks.push(`Mapa desfavorável: ${map.name}`);
  }
  if (draft.mode && guide?.bestModes?.includes(draft.mode)) {
    strategicPoints += 2;
    strategicReasons.push("Modo de destaque");
  }
  [...new Set(enemies)].forEach((enemyId) => {
    const enemyName = name(enemyId);
    const guideMatchup = getGuideMatchup(ds, id, enemyId);
    if (!guideMatchup.known) return;

    if (guideMatchup.score === -5) {
      strategicPoints += GUIDE_SCORING_RULES.hardCounter;
      strategicReasons.push(`${enemyName} é Hard Counter de ${br.name}`);
      strategicRisks.push(`${enemyName} é Hard Counter de ${br.name}`);
    } else if (guideMatchup.score === 5) {
      strategicPoints += GUIDE_SCORING_RULES.hardCounterAdvantage;
      strategicReasons.push(`${br.name} é Hard Counter de ${enemyName}`);
      strategicPositives.push(`${br.name} é Hard Counter de ${enemyName}`);
    } else if (guideMatchup.score === -2) {
      strategicPoints += GUIDE_SCORING_RULES.countered;
      strategicReasons.push(`É counterado por ${enemyName}`);
      strategicRisks.push(`É counterado por ${enemyName}`);
    } else if (guideMatchup.score === 2) {
      strategicPoints += GUIDE_SCORING_RULES.counterAdvantage;
      strategicReasons.push(`Countera ${enemyName}`);
      strategicPositives.push(`Countera ${enemyName}`);
    }
  });
  allies.forEach((allyId) => {
    const allyGuide = getGuideEntry(allyId);
    if (guide?.synergies.includes(allyId) || allyGuide?.synergies.includes(id)) {
      strategicPoints += GUIDE_SCORING_RULES.teamSynergy;
      strategicReasons.push(`Sinergia de equipe com ${name(allyId)}`);
      strategicPositives.push(`Sinergia de equipe com ${name(allyId)}`);
    }
  });
  if (warning && applyLastPickPenalty && picked(draft).length < 5) {
    strategicPoints += GUIDE_SCORING_RULES.lastPickWarning;
    strategicReasons.push("Alerta de last pick (-2)");
  }
  strategicPositives.forEach((reason) => {
    if (!positives.includes(reason)) positives.push(reason);
  });
  strategicRisks.forEach((reason) => {
    if (!risks.includes(reason)) risks.push(reason);
  });
  if (warning) risks.push(warning);

  return {
    id,
    score: clamp(Math.round(total * 100) + strategicPoints, 0, 100),
    components,
    matchups: mc.cells,
    worst: mc.worst,
    penalty: mc.penalty,
    synergyAvg,
    synergyNotes: syn
      .filter((s) => s.known)
      .map((s) => `${name(s.a)} ${s.score > 0 ? "+" : ""}${s.score}`),
    mapValue: mpf.value,
    confidence,
    confidenceValue,
    matchupCoverage,
    positives,
    risks,
    strategicPoints,
    strategicReasons,
    warning,
  };
}

/** Ranks every brawler not yet picked by either team (ranked: no duplicates in the draft). */
export function rankCandidates(
  ds: Dataset,
  draft: DraftState,
  opts: {
    weights?: Weights;
    limit?: number;
    allySlot?: number;
    excludeIds?: readonly string[];
  } = {},
) {
  const taken = new Set(picked(draft));
  opts.excludeIds?.forEach((id) => taken.add(id));
  if (opts.allySlot !== undefined) {
    const cur = draft.allies[opts.allySlot];
    if (cur) taken.delete(cur);
  }
  return ds.brawlers
    .filter((b) => b.available !== false && !taken.has(b.id))
    .map((b) => scoreCandidate(ds, b.id, draft, opts.weights, opts.allySlot))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.strategicPoints - a.strategicPoints ||
        b.confidenceValue - a.confidenceValue ||
        a.id.localeCompare(b.id),
    )
    .slice(0, opts.limit ?? Infinity);
}

const COMP_LABEL: Record<keyof Weights, string> = {
  matchup: "matchups",
  synergy: "sinergia",
  fit: "adequação ao modo e mapa",
  coverage: "cobertura da equipe",
  risk: "risco de fraquezas acumuladas",
};

export function explainLeader(
  ds: Dataset,
  ranked: CandidateResult[],
  weights: Weights = DEFAULT_WEIGHTS,
): string | null {
  if (ranked.length < 2) return null;
  const a = ranked[0]!,
    b = ranked[1]!;
  const n = (id: string) => ds.brawlers.find((x) => x.id === id)!.name;
  const diffs = (Object.keys(weights) as (keyof Weights)[])
    .map((k) => ({ k, d: (a.components[k] - b.components[k]) * weights[k] }))
    .sort((x, y) => y.d - x.d);
  const top = diffs
    .filter((x) => x.d > 0.001)
    .slice(0, 2)
    .map((x) => COMP_LABEL[x.k]);
  if (!top.length)
    return `${n(a.id)} e ${n(b.id)} estão praticamente empatados; desempate por confiança dos dados.`;
  let s = `${n(a.id)} supera ${n(b.id)} principalmente em ${top.join(" e ")}.`;
  if (b.penalty > a.penalty) s += ` ${n(b.id)} sofre penalidade por um matchup muito desfavorável.`;
  return s;
}

export interface Limitation {
  level: "info" | "aviso";
  text: string;
}
export function draftLimitations(
  ds: Dataset,
  draft: DraftState,
  ranked: CandidateResult[],
): Limitation[] {
  const out: Limitation[] = [];
  const known = draft.enemies.filter(Boolean).length;
  if (known < 3)
    out.push({
      level: "aviso",
      text:
        known === 0
          ? "Nenhum adversário conhecido: recomendações baseadas só em mapa, modo e equipe."
          : `Apenas ${known} de 3 adversários conhecidos: a análise pode mudar.`,
    });
  if (!draft.mapId)
    out.push({
      level: "info",
      text: "Sem mapa selecionado: adequação ao terreno usa valor neutro.",
    });
  else if (
    ranked[0] &&
    !mapFit(
      ds.brawlers.find((brawler) => brawler.id === ranked[0]!.id)!,
      ds.maps.find((map) => map.id === draft.mapId),
    ).known
  )
    out.push({
      level: "info",
      text: "O guia não tem destaque para o melhor candidato neste mapa: adequação ao mapa tratada como neutra.",
    });
  if (!draft.mode) out.push({ level: "info", text: "Sem modo selecionado." });
  else if (
    ranked[0] &&
    !modeFit(
      ds.brawlers.find((brawler) => brawler.id === ranked[0]!.id)!,
      draft.mode,
    ).known
  )
    out.push({
      level: "info",
      text: "O guia não tem modos de destaque para o melhor candidato: adequação ao modo tratada como neutra.",
    });
  if (ranked[0] && ranked[0].matchups.length > 0 && ranked[0].matchupCoverage < 1) {
    const knownTop = ranked[0].matchups.filter((m) => m.known).length;
    out.push({
      level: "aviso",
      text: `Cobertura de matchups do melhor candidato: ${knownTop}/${ranked[0].matchups.length}. Matchups sem registro não são evidência de neutralidade; trate a recomendação como provisória.`,
    });
  }
  if (ranked[0] && ranked[0].confidence === "baixa")
    out.push({
      level: "aviso",
      text: "Confiança baixa: a qualidade ou a cobertura dos dados é insuficiente para uma recomendação forte.",
    });
  return out;
}

export interface CompositionResult {
  score: number;
  components: Record<keyof Weights, number>;
  positives: string[];
  issues: string[];
}

export function analyzeComposition(
  ds: Dataset,
  draft: DraftState,
  weights: Weights = DEFAULT_WEIGHTS,
): CompositionResult | null {
  const allies = draft.allies.filter((x): x is string => !!x);
  if (!allies.length) return null;
  const B = (id: string) => ds.brawlers.find((x) => x.id === id)!;
  const enemies = draft.enemies.filter((x): x is string => !!x);
  const ctx: Context = { mapId: draft.mapId, mode: draft.mode };
  const map = ds.maps.find((m) => m.id === draft.mapId) ?? null;
  const mode = ds.modes.find((m) => m.id === draft.mode) ?? null;
  const team = allies.map(B);
  const foes = enemies.map(B);
  const positives: string[] = [];
  const issues: string[] = [];

  const matchup = mean(allies.map((a) => matchupComponent(ds, a, enemies, ctx).value));
  const pairs: number[] = [];
  for (let i = 0; i < allies.length; i++)
    for (let j = i + 1; j < allies.length; j++) {
      const s = getSynergy(ds, allies[i]!, allies[j]!);
      pairs.push(s.score);
      if (s.score >= 1)
        positives.push(`${B(allies[i]!).name} + ${B(allies[j]!).name}: ${s.entry!.explanation}`);
      if (s.score <= -1)
        issues.push(`${B(allies[i]!).name} + ${B(allies[j]!).name}: ${s.entry!.explanation}`);
    }
  const synergy = pairs.length ? norm3(mean(pairs)) : 0.5;
  const fit = mean(team.map((b) => mean([modeFit(b, draft.mode).value, mapFit(b, map).value])));
  const roles = new Set(team.map((b) => b.role));
  const ranges = new Set(team.map((b) => b.range));
  const coverage = clamp(
    0.5 * (roles.size / team.length) + 0.5 * (ranges.size / Math.min(3, team.length)),
  );

  // Shared weaknesses that the enemy can actually exploit.
  const tagCount: Record<string, number> = {};
  team.forEach((b) => b.weakTo.forEach((t) => (tagCount[t] = (tagCount[t] ?? 0) + 1)));
  const exploited = Object.entries(tagCount).filter(
    ([t, c]) => c >= 2 && foes.some((f) => f.provides.includes(t)),
  );
  exploited.forEach(([t, c]) => {
    const who = foes
      .filter((f) => f.provides.includes(t))
      .map((f) => f.name)
      .join(", ");
    issues.push(`${c} aliados vulneráveis a ${t.replaceAll("_", " ")}, explorado por ${who}.`);
  });
  const risk = clamp(1 - exploited.length * 0.3);

  if (
    team.length >= 2 &&
    foes.filter((f) => f.range === "longo").length >= 2 &&
    !team.some((b) => b.range === "longo" || b.mobility === 3)
  )
    issues.push("Pouco alcance ou mobilidade para enfrentar adversários de longa distância.");
  if (team.length === 3 && roles.size === 1)
    issues.push(`Composição dependente de uma única condição de vitória (três ${[...roles][0]}).`);
  if (
    mode &&
    team.length === 3 &&
    !team.some(
      (b) =>
        mode.objectiveRoles.includes(b.role) || getGuideEntry(b.id)?.bestModes?.includes(mode.id),
    )
  )
    issues.push(
      `Nenhum aliado tem perfil de objetivo para ${mode.name}; avalie como controlar o objetivo.`,
    );
  const avgArea = mean(team.map((b) => b.areaControl));
  if (team.length === 3 && avgArea >= 2) positives.push("Bom controle de área combinado.");
  if (roles.size === team.length && team.length > 1) positives.push("Funções bem distribuídas.");
  if (matchup >= 0.6 && enemies.length)
    positives.push("Matchups favoráveis contra a equipe adversária.");
  if (matchup <= 0.4 && enemies.length)
    issues.push("Matchups desfavoráveis contra a equipe adversária no geral.");

  const components = { matchup, synergy, fit, coverage, risk };
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const total =
    (Object.keys(weights) as (keyof Weights)[]).reduce(
      (s, k) => s + weights[k] * components[k],
      0,
    ) / wsum;
  return { score: Math.round(total * 100), components, positives, issues };
}

export const PATHS: {
  id: string;
  title: string;
  description: string;
  risk: string;
  weights: Weights;
}[] = [
  {
    id: "matchup",
    title: "Opção A — Priorizar matchup",
    description: "Maximiza vantagem contra os adversários conhecidos.",
    risk: "Pode deixar a equipe com funções repetidas ou pouca sinergia.",
    weights: { matchup: 0.7, synergy: 0.1, fit: 0.1, coverage: 0.05, risk: 0.05 },
  },
  {
    id: "synergy",
    title: "Opção B — Priorizar sinergia",
    description: "Escolhe quem melhor complementa os aliados.",
    risk: "Pode ignorar counters dos adversários.",
    weights: { matchup: 0.25, synergy: 0.45, fit: 0.15, coverage: 0.1, risk: 0.05 },
  },
  {
    id: "safe",
    title: "Opção C — Segurança e flexibilidade",
    description: "Favorece cobertura de funções, encaixe no mapa e poucas fraquezas.",
    risk: "Vantagens menores; raramente a escolha mais forte.",
    weights: { matchup: 0.3, synergy: 0.1, fit: 0.25, coverage: 0.2, risk: 0.15 },
  },
];
