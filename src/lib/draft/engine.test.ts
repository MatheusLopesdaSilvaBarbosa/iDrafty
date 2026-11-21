import { describe, expect, it } from "vitest";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS, MODES } from "@/data/maps";
import { SYNERGIES } from "@/data/matchups";
import {
  getDraftWarning,
  getAvailableHardCounters,
  getMatchupGuideEntry,
  getGuideBadges,
  GUIDE_BY_BRAWLER_ID,
  GUIDE_SCORING_RULES,
} from "@/data/strategy-guide";
import {
  DEFAULT_WEIGHTS,
  getMatchup,
  getGuideMatchup,
  getSynergy,
  mapFit,
  modeFit,
  rankCandidates,
  scoreCandidate,
} from "@/lib/draft/engine";
import { guideMatchupKey, type Dataset, type DraftState, type Matchup } from "@/lib/draft/types";
import { buildDataset } from "@/lib/draft/store";

const sampleMatchup: Matchup = {
  attacker: "shelly",
  defender: "bull",
  score: 2,
  explanation: "Regra de teste.",
  source: "manual",
  confidence: "media",
  status: "avaliacao_manual",
  reviewed: "2026-10-31",
};

const ds: Dataset = {
  brawlers: BRAWLERS,
  maps: MAPS,
  modes: MODES,
  matchups: [],
  synergies: SYNERGIES,
};

const emptyDraft: DraftState = {
  mode: null,
  mapId: null,
  allies: [null, null, null],
  enemies: [null, null, null],
};

describe("draft recommendation engine", () => {
  it("uses the requested scoring weights, totaling 100%", () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      matchup: 0.4,
      synergy: 0.1,
      fit: 0.4,
      coverage: 0.05,
      risk: 0.05,
    });
    expect(Object.values(DEFAULT_WEIGHTS).reduce((total, weight) => total + weight, 0)).toBe(1);
  });

  it("contains the complete 109-brawler roster supplied for the app", () => {
    expect(BRAWLERS).toHaveLength(109);
    expect(new Set(BRAWLERS.map((b) => b.id)).size).toBe(109);
    expect(new Set(BRAWLERS.map((b) => b.name.toLowerCase())).size).toBe(109);
  });

  it("contains the updated Ranked maps across the six supplied modes", () => {
    expect(MAPS).toHaveLength(28);
    expect(
      MODES.map((mode) => [mode.name, MAPS.filter((map) => map.mode === mode.id).length]),
    ).toEqual([
      ["Pique-Gema", 4],
      ["Fura-Cofre", 4],
      ["Caça-Estrelas", 4],
      ["Fute-Brawl", 4],
      ["Zona Estratégica", 4],
      ["Nocaute", 6],
    ]);
    expect(MAPS.map((map) => map.name)).toEqual([
      "Double Swoosh",
      "Gem Fort",
      "Hard Rock Mine",
      "Undermine",
      "Crystal Arcade",
      "Bridge Too Far",
      "Hot Potato",
      "Kaboom Canyon",
      "Safe Zone",
      "Dry Season",
      "Hideout",
      "Layer Cake",
      "Shooting Star",
      "Center Stage",
      "Pinball Dreams",
      "Sneaky Fields",
      "Triple Dribble",
      "Beach Ball",
      "Dueling Beetles",
      "Open Business",
      "Parallel Plays",
      "Ring of Fire",
      "Belle's Rock",
      "Flaring Phoenix",
      "Flowing Springs",
      "Goldarm Gulch",
      "New Horizons",
      "Out in the Open",
    ]);
  });

  it("assigns the supplied rarity distribution to every available brawler", () => {
    const available = BRAWLERS.filter((b) => b.available !== false);
    const counts = Object.fromEntries(
      ["Inicial", "Raro", "Super-raro", "Épico", "Mítico", "Lendário", "Ultralendário"].map(
        (rarity) => [rarity, available.filter((b) => b.rarity === rarity).length],
      ),
    );
    expect(counts).toEqual({
      Inicial: 1,
      Raro: 8,
      "Super-raro": 10,
      Épico: 30,
      Mítico: 43,
      Lendário: 14,
      Ultralendário: 2,
    });
    expect(BRAWLERS.filter((b) => b.rarity === "Indisponível").map((b) => b.id)).toEqual([
      "lightyear-indisponivel",
    ]);
  });

  it("does not recommend Lightyear while marked unavailable", () => {
    const ranked = rankCandidates(ds, emptyDraft);
    expect(ranked.some((candidate) => candidate.id === "lightyear-indisponivel")).toBe(false);
  });

  it("excludes brawlers marked as banned from recommendations", () => {
    const ranked = rankCandidates(ds, emptyDraft, {
      limit: 3,
      excludeIds: ["shelly"],
    });

    expect(ranked).toHaveLength(3);
    expect(ranked.some((candidate) => candidate.id === "shelly")).toBe(false);
  });

  it("ranks opponent picks against our team and their picked allies", () => {
    const draft: DraftState = {
      ...emptyDraft,
      allies: ["belle", null, null],
      enemies: ["gene", null, null],
    };
    const opponentPerspective: DraftState = {
      ...draft,
      allies: draft.enemies,
      enemies: draft.allies,
    };
    const candidate = rankCandidates(ds, opponentPerspective).find((entry) => entry.id === "max");

    expect(candidate?.matchups.map((matchup) => matchup.enemyId)).toEqual(["belle"]);
    expect(candidate?.synergyNotes).toContain("Eugênio +2");
  });

  it("loads the 108-brawler strategy guide and its meta tiers", () => {
    expect(Object.keys(GUIDE_BY_BRAWLER_ID)).toHaveLength(108);
    expect(
      Object.values(GUIDE_BY_BRAWLER_ID).every((entry) => Array.isArray(entry.bestModes)),
    ).toBe(true);
    expect(
      Object.values(GUIDE_BY_BRAWLER_ID).every(
        (entry) => Array.isArray(entry.maps) && entry.maps.length > 0,
      ),
    ).toBe(true);
    expect(
      Object.values(GUIDE_BY_BRAWLER_ID).every(
        (entry) => !("mogga" in entry) && !("counters" in entry),
      ),
    ).toBe(true);
    expect(
      Object.values(GUIDE_BY_BRAWLER_ID).every((entry) => Array.isArray(entry.worstMaps)),
    ).toBe(true);
    expect(Object.values(GUIDE_BY_BRAWLER_ID).filter((entry) => entry.meta)).toHaveLength(9);
    expect(Object.values(GUIDE_BY_BRAWLER_ID).filter((entry) => entry.subMeta)).toHaveLength(11);
  });

  it("keeps Ring of Fire neutral for artillery while retaining their other map penalties", () => {
    for (const id of ["barley", "dynamike", "grom"]) {
      expect(GUIDE_BY_BRAWLER_ID[id]?.worstMaps).not.toContain("ring_of_fire");
    }
    expect(GUIDE_BY_BRAWLER_ID["larry-lawrie"]?.worstMaps ?? []).not.toContain("ring_of_fire");
    expect(GUIDE_BY_BRAWLER_ID["tick"]?.worstMaps).toEqual([]);
    expect(GUIDE_BY_BRAWLER_ID["sprout"]?.worstMaps).toEqual([]);

    const result = scoreCandidate(ds, "barley", { ...emptyDraft, mapId: "safe_zone" });
    expect(result.strategicPoints).toBe(
      GUIDE_SCORING_RULES.worstMap + GUIDE_SCORING_RULES.lastPickWarning,
    );
    expect(result.strategicReasons).toContain("Mapa desfavorável: Safe Zone");
    expect(result.risks).toContain("Mapa desfavorável: Safe Zone");
  });

  it("marks the requested tanks and support brawlers as weak on open maps", () => {
    const worstMaps = [
      "bridge_too_far",
      "safe_zone",
      "shooting_star",
      "flowing_springs",
      "out_in_the_open",
    ];
    for (const id of [
      "ash",
      "el-primo",
      "rosa",
      "bull",
      "nita",
      "poco",
      "jacky",
      "frank",
      "hank",
      "doug",
      "draco",
    ]) {
      expect(GUIDE_BY_BRAWLER_ID[id]?.worstMaps).toEqual(worstMaps);
    }

    const result = scoreCandidate(ds, "bull", { ...emptyDraft, mapId: "flowing_springs" });
    expect(result.strategicPoints).toBe(GUIDE_SCORING_RULES.worstMap);
    expect(result.strategicReasons).toContain("Mapa desfavorável: Flowing Springs");
  });

  it("adds guide points for META status and map highlights", () => {
    const draft: DraftState = { ...emptyDraft, mode: "gem_grab", mapId: "double_swoosh" };
    const result = scoreCandidate(ds, "amber", draft);
    expect(result.strategicPoints).toBe(10);
    expect(result.strategicReasons).toContain("🌟 META");
    expect(result.strategicReasons).toContain("Destaque no mapa Double Swoosh");
  });

  it("uses the guide's best modes and map highlights as the fit source", () => {
    const max = BRAWLERS.find((brawler) => brawler.id === "max")!;
    const sneakyFields = MAPS.find((map) => map.id === "sneaky_fields")!;
    const bridgeTooFar = MAPS.find((map) => map.id === "bridge_too_far")!;

    expect(modeFit(max, "bounty")).toEqual({ value: 1, known: true });
    expect(modeFit(max, "heist")).toEqual({ value: 0.4, known: true });
    expect(mapFit(max, sneakyFields)).toEqual({ value: 1, known: true, specific: true });
    expect(mapFit(max, bridgeTooFar)).toEqual({ value: 0.4, known: true, specific: false });
  });

  it("applies explicit best, neutral, and worst map tiers to draft scores", () => {
    const map = MAPS.find((candidate) => candidate.id === "double_swoosh")!;
    const brawler = BRAWLERS.find((candidate) => candidate.id === "amber")!;
    const draft = { ...emptyDraft, mapId: map.id };
    const withTier = (tier: "best" | "neutral" | "worst"): Dataset => ({
      ...ds,
      maps: ds.maps.map((candidate) =>
        candidate.id === map.id
          ? { ...candidate, brawlerTiers: { amber: tier } }
          : candidate,
      ),
    });

    expect(mapFit(brawler, { ...map, brawlerTiers: { amber: "best" } })).toMatchObject({
      value: 1,
      known: true,
      specific: true,
    });
    expect(mapFit(brawler, { ...map, brawlerTiers: { amber: "neutral" } })).toMatchObject({
      value: 0.4,
      known: true,
      specific: false,
    });
    expect(mapFit(brawler, { ...map, brawlerTiers: { amber: "worst" } })).toMatchObject({
      value: 0.1,
      known: true,
      specific: false,
    });

    const best = scoreCandidate(withTier("best"), "amber", draft);
    const neutral = scoreCandidate(withTier("neutral"), "amber", draft);
    const worst = scoreCandidate(withTier("worst"), "amber", draft);
    expect(best.mapValue).toBe(1);
    expect(neutral.mapValue).toBe(0.4);
    expect(worst.mapValue).toBe(0.1);
    expect(best.strategicReasons).toContain("Destaque no mapa Double Swoosh");
    expect(neutral.strategicReasons).not.toContain("Destaque no mapa Double Swoosh");
    expect(worst.strategicReasons).toContain("Mapa desfavorável: Double Swoosh");
    expect(best.score).toBeGreaterThan(neutral.score);
    expect(neutral.score).toBeGreaterThan(worst.score);
  });

  it("uses custom mode recommendations instead of guide defaults when scoring", () => {
    const max = BRAWLERS.find((brawler) => brawler.id === "max")!;
    const customizedDataset: Dataset = {
      ...ds,
      modes: MODES.map((mode) =>
        mode.id === "bounty" ? { ...mode, recommendedBrawlers: ["max"] } : mode,
      ),
    };
    const draft: DraftState = { ...emptyDraft, mode: "bounty" };

    expect(modeFit(max, "bounty", [])).toEqual({ value: 0.4, known: true });
    expect(modeFit(max, "bounty", ["max"])).toEqual({ value: 1, known: true });
    const maxResult = scoreCandidate(customizedDataset, "max", draft);
    const shellyResult = scoreCandidate(customizedDataset, "shelly", draft);
    expect(maxResult.components.fit).toBe(0.75);
    expect(maxResult.strategicReasons).toContain("Modo de destaque");
    expect(shellyResult.components.fit).toBe(0.45);
    expect(shellyResult.strategicReasons).not.toContain("Modo de destaque");
  });

  it("applies recommendations saved in the mode bank to live draft scores", () => {
    const customizedDataset = buildDataset([], {}, [], {}, {}, {}, { bounty: ["shelly"] });
    const draft: DraftState = { ...emptyDraft, mode: "bounty" };
    const recommended = scoreCandidate(customizedDataset, "shelly", draft);
    const unlisted = scoreCandidate(customizedDataset, "max", draft);

    expect(recommended.components.fit).toBe(0.75);
    expect(unlisted.components.fit).toBe(0.45);
    expect(recommended.strategicReasons).toContain("Modo de destaque");
    expect(unlisted.strategicReasons).not.toContain("Modo de destaque");
    expect(recommended.score).toBeGreaterThan(unlisted.score);
  });

  it("scores Max higher in Bounty than Heist based on the guide's bestModes", () => {
    const heist = scoreCandidate(ds, "max", {
      ...emptyDraft,
      mode: "heist",
      enemies: ["brock", null, null],
    });
    const bounty = scoreCandidate(ds, "max", {
      ...emptyDraft,
      mode: "bounty",
      enemies: ["brock", null, null],
    });

    expect(bounty.components.fit).toBeGreaterThan(heist.components.fit);
    expect(bounty.score - heist.score).toBe(14);
  });

  it("shows only the good mode fit in card positives while keeping the guide bonus", () => {
    const result = scoreCandidate(ds, "amber", {
      ...emptyDraft,
      mode: "gem_grab",
    });

    expect(result.positives).toContain("Bom no modo de jogo");
    expect(result.positives).not.toContain("Modo de destaque");
    expect(result.strategicReasons).toContain("Modo de destaque");
  });

  it("awards the support bonus only until the team picks its first support", () => {
    const firstSupport = scoreCandidate(ds, "8-bit", emptyDraft);
    const afterSupportPicked = scoreCandidate(ds, "8-bit", {
      ...emptyDraft,
      allies: ["byron", null, null],
    });

    expect(firstSupport.strategicReasons).toContain("Suporte à equipe");
    expect(afterSupportPicked.strategicReasons).not.toContain("Suporte à equipe");
    expect(firstSupport.strategicPoints - afterSupportPicked.strategicPoints).toBe(
      GUIDE_SCORING_RULES.support,
    );
  });

  it("applies the guide hard-counter penalty and displays a draft warning", () => {
    const draft: DraftState = { ...emptyDraft, enemies: ["bull", null, null] };
    const result = scoreCandidate(ds, "alli", draft);
    expect(result.strategicPoints).toBe(-5);
    expect(result.strategicReasons).toContain("Bull é Hard Counter de Alli");
    expect(result.risks).toContain("Bull é Hard Counter de Alli");
    expect(result.warning).toContain("last pick");
  });

  it("lists Starr Nova as a hard counter to every other assassin", () => {
    const assassins = BRAWLERS.filter(
      (brawler) => brawler.role === "Assassino" && brawler.id !== "starr-nova",
    );

    expect(assassins.length).toBeGreaterThan(0);
    for (const assassin of assassins) {
      expect(getMatchupGuideEntry(assassin.id)?.hardCounters).toContain("starr-nova");
    }
    expect(getMatchupGuideEntry("starr-nova")?.hardCounters).not.toContain("starr-nova");
  });

  it("lists standard launcher counters as regular counters to Ziggy", () => {
    const launcherCounters = [
      "darryl",
      "edgar",
      "fang",
      "kenji",
      "lily",
      "melodie",
      "mico",
      "mortis",
    ];

    for (const counterId of launcherCounters) {
      expect(getMatchupGuideEntry("ziggy")?.counteredBy).toContain(counterId);
      expect(getMatchupGuideEntry("ziggy")?.hardCounters).not.toContain(counterId);
      expect(getGuideMatchup(ds, "ziggy", counterId)).toMatchObject({
        score: -2,
        known: true,
      });
    }
  });

  it("lists Wendy only as a regular counter, not as a hard counter", () => {
    expect(
      Object.values(GUIDE_BY_BRAWLER_ID).some((entry) => entry.hardCounters.includes("wendy")),
    ).toBe(false);
    expect(getMatchupGuideEntry("angelo")?.counteredBy).toContain("wendy");
    expect(getMatchupGuideEntry("colette")?.counteredBy).toContain("wendy");
    expect(getMatchupGuideEntry("wendy")?.hardCounters).toContain("edgar");
  });

  it("warns that Mr. P is a situational pick without asserting unreviewed counters", () => {
    expect(getDraftWarning("mister-p")).toContain("escolha situacional");
    expect(getDraftWarning("mister-p")).not.toContain("Edgar, Fang ou Kenji");
    expect(getGuideBadges("mister-p")).toContain("⚠ LAST PICK");
  });

  it("allows local tier classifications to override guide badges", () => {
    expect(
      getGuideBadges("chester", undefined, undefined, { meta: false, subMeta: true }),
    ).toContain("✨ SUB-META");
    expect(
      getGuideBadges("chester", undefined, undefined, { meta: false, subMeta: true }),
    ).not.toContain("🌟 META");
  });

  it("ignores Mr. P's unreviewed declarations but keeps reviewed references to him", () => {
    expect(getMatchupGuideEntry("grom")?.hardCounters).toContain("mister-p");
    expect(getMatchupGuideEntry("mister-p")?.hardCounters).toEqual([]);
    expect(
      ["edgar", "fang", "kenji"].some((id) =>
        getMatchupGuideEntry("mister-p")?.hardCounters.includes(id),
      ),
    ).toBe(false);
    expect(getAvailableHardCounters("mister-p", new Set())).not.toContain("edgar");
    expect(getGuideMatchup(ds, "mister-p", "edgar").known).toBe(false);
    expect(getGuideMatchup(ds, "mister-p", "grom")).toMatchObject({
      score: 5,
      known: true,
    });
  });

  it("awards hard-counter advantage and keeps hard-counter penalties", () => {
    const hardCounterResult = scoreCandidate(ds, "belle", {
      ...emptyDraft,
      enemies: ["nori", null, null],
    });
    const hardCounterPenalty = scoreCandidate(ds, "alli", {
      ...emptyDraft,
      enemies: ["bull", null, null],
    });

    expect(hardCounterResult.strategicPoints).toBe(5);
    expect(hardCounterResult.strategicReasons).toContain("Belle é Hard Counter de Nori");
    expect(hardCounterResult.positives).toContain("Belle é Hard Counter de Nori");
    expect(hardCounterResult.matchups[0]).toMatchObject({
      enemyId: "nori",
      score: 5,
      known: true,
    });
    expect(hardCounterPenalty.strategicPoints).toBe(-5);
    expect(hardCounterPenalty.strategicReasons).toContain("Bull é Hard Counter de Alli");
  });

  it("applies at most one guide matchup adjustment per enemy", () => {
    const belleWithoutEnemy = scoreCandidate(ds, "belle", emptyDraft);
    const belleAgainstEightBit = scoreCandidate(ds, "belle", {
      ...emptyDraft,
      enemies: ["8-bit", "8-bit", null],
    });
    expect(belleAgainstEightBit.strategicPoints - belleWithoutEnemy.strategicPoints).toBe(
      GUIDE_SCORING_RULES.countered,
    );
    expect(belleAgainstEightBit.strategicReasons).toContain("É counterado por 8-BIT");
    expect(belleAgainstEightBit.strategicReasons).not.toContain("Countera 8-BIT");

    const barleyWithoutEnemy = scoreCandidate(ds, "barley", emptyDraft);
    const barleyAgainstPenny = scoreCandidate(ds, "barley", {
      ...emptyDraft,
      enemies: ["penny", null, null],
    });
    expect(barleyAgainstPenny.strategicPoints - barleyWithoutEnemy.strategicPoints).toBe(
      GUIDE_SCORING_RULES.hardCounter,
    );
    expect(barleyAgainstPenny.strategicReasons).toContain("Penny é Hard Counter de Barley");
    expect(barleyAgainstPenny.strategicReasons).not.toContain("Barley é Hard Counter de Penny");
  });

  it("shows a positive matchup when the candidate hard-counters the enemy", () => {
    const result = getMatchup(ds, "belle", "gene");
    expect(result).toMatchObject({
      score: 5,
      known: true,
    });
  });

  it("exposes guide matchups and supports locally disabling one", () => {
    const guideMatchup = getGuideMatchup(ds, "belle", "gene");
    expect(guideMatchup.entry?.source).toBe("Guia estratégico de 108 Brawlers");

    const hidden = getGuideMatchup(
      { ...ds, disabledGuideMatchups: [guideMatchupKey("belle", "gene")] },
      "belle",
      "gene",
    );
    expect(hidden.known).toBe(false);
  });

  it("uses the guide's team synergy recommendations", () => {
    expect(getSynergy(ds, "gus", "bibi").score).toBe(2);
    const draft: DraftState = { ...emptyDraft, allies: ["bibi", null, null] };
    const result = scoreCandidate(ds, "gus", draft);
    expect(result.strategicPoints).toBe(6);
    expect(result.strategicReasons).toContain("🌟 META");
    expect(result.strategicReasons).toContain("Sinergia de equipe com Bibi");
  });

  it("pairs Meeple with every thrower, Shade, Hank, and Nori", () => {
    const partners = [
      "barley",
      "dynamike",
      "grom",
      "larry-lawrie",
      "juju",
      "sprout",
      "tick",
      "willow",
      "shade",
      "hank",
      "nori",
    ];

    for (const partner of partners) {
      expect(GUIDE_BY_BRAWLER_ID[partner]?.synergies).toContain("meeple");
      expect(GUIDE_BY_BRAWLER_ID["meeple"]?.synergies).toContain(partner);
      expect(getSynergy(ds, "meeple", partner).known).toBe(true);
    }
  });

  it("uses the inverse of a recorded matchup when no direct record exists", () => {
    const result = getMatchup({ ...ds, matchups: [sampleMatchup] }, "bull", "shelly");
    expect(result.known).toBe(true);
    expect(result.inverted).toBe(true);
    expect(result.score).toBe(-2);
  });

  it("marks missing matchups as unknown instead of presenting them as neutral facts", () => {
    const result = getMatchup(ds, "shelly", "gene");
    expect(result.known).toBe(false);
    expect(result.scope).toBe("desconhecido");
  });

  it("does not recommend brawlers already selected in either team", () => {
    const draft: DraftState = {
      ...emptyDraft,
      allies: ["shelly", null, null],
      enemies: ["bull", null, null],
    };
    const ranked = rankCandidates(ds, draft);
    expect(ranked.some((x) => x.id === "shelly" || x.id === "bull")).toBe(false);
  });

  it("reports matchup data coverage separately from the strategic score", () => {
    const draft: DraftState = {
      ...emptyDraft,
      enemies: ["bull", "mortis", "gene"],
    };
    const result = scoreCandidate(ds, "shelly", draft);
    expect(result.matchups).toHaveLength(3);
    expect(result.matchupCoverage).toBeGreaterThanOrEqual(0);
    expect(result.matchupCoverage).toBeLessThanOrEqual(1);
    expect(result.matchups.some((x) => !x.known)).toBe(true);
  });

  it("uses the full -5..+5 range when scoring edited matchups", () => {
    const matchup = sampleMatchup;
    const positive = scoreCandidate({ ...ds, matchups: [{ ...matchup, score: 5 }] }, "shelly", {
      ...emptyDraft,
      enemies: ["bull", null, null],
    });
    const negative = scoreCandidate({ ...ds, matchups: [{ ...matchup, score: -5 }] }, "shelly", {
      ...emptyDraft,
      enemies: ["bull", null, null],
    });

    expect(positive.matchups[0]?.score).toBe(5);
    expect(positive.components.matchup).toBe(1);
    expect(negative.matchups[0]?.score).toBe(-5);
    expect(negative.components.matchup).toBe(0);
  });

  it("returns a deterministic ranking for the same draft and dataset", () => {
    const draft: DraftState = {
      ...emptyDraft,
      mode: "knockout",
      mapId: "belles_rock",
      allies: ["gene", "piper", null],
      enemies: ["bull", "mortis", "tick"],
    };
    expect(rankCandidates(ds, draft, { limit: 5 }).map((x) => x.id)).toEqual(
      rankCandidates(ds, draft, { limit: 5 }).map((x) => x.id),
    );
  });
});
