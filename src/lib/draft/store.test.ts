import { describe, expect, it } from "vitest";
import type { DraftState, Matchup } from "./types";
import {
  EMPTY_DRAFT,
  advanceToCoinSelection,
  beginDraftFlow,
  beginPicks,
  buildDataset,
  createCustomRulesBackup,
  getDraftStage,
  getDefaultBrawlerTier,
  getDefaultMapBrawlers,
  getDefaultModeBrawlers,
  getNextPickTeam,
  getPickOrder,
  isGuideMatchupOverride,
  matchupIdentity,
  parseCustomRulesBackup,
  sanitizeBannedBrawlers,
  sanitizeDisabledMaps,
  sanitizeCustomMatchups,
  sanitizeCustomMapBrawlers,
  sanitizeCustomMapBrawlerTiers,
  sanitizeCustomBrawlerTiers,
  sanitizeCustomModeBrawlers,
  undoLastPick,
} from "./store";

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

const startedDraft: DraftState = {
  coin: "blue",
  started: true,
  mode: null,
  mapId: null,
  allies: ["shelly", null, null],
  enemies: ["bull", null, null],
};

describe("draft pick undo", () => {
  it("defines the six global pick positions for either coin", () => {
    expect(getPickOrder("blue")).toEqual([
      "allies",
      "enemies",
      "enemies",
      "allies",
      "allies",
      "enemies",
    ]);
    expect(getPickOrder("red")).toEqual([
      "enemies",
      "allies",
      "allies",
      "enemies",
      "enemies",
      "allies",
    ]);
  });

  it("removes the most recent pick according to the coin's pick order", () => {
    const undone = undoLastPick(startedDraft);

    expect(undone.allies).toEqual(["shelly", null, null]);
    expect(undone.enemies).toEqual([null, null, null]);
    expect(getNextPickTeam(undone)).toBe("enemies");
  });

  it("does not change the draft when there are no picks to undo", () => {
    const emptyDraft = { ...startedDraft, allies: [null, null, null], enemies: [null, null, null] };

    expect(undoLastPick(emptyDraft)).toBe(emptyDraft);
  });
});

describe("banned brawlers", () => {
  it("keeps unique available brawler IDs and rejects invalid values", () => {
    expect(
      sanitizeBannedBrawlers(["shelly", "shelly", "not-a-brawler", "lightyear-indisponivel", null]),
    ).toEqual(["shelly"]);
  });
});

describe("map rotation", () => {
  it("keeps unique known map IDs when sanitizing disabled maps", () => {
    expect(sanitizeDisabledMaps(["ring_of_fire", "ring_of_fire", "unknown_map", null])).toEqual([
      "ring_of_fire",
    ]);
  });
});

describe("dataset matchup source", () => {
  it("uses only user-defined matchups as structured matchup data", () => {
    const dataset = buildDataset([]);

    expect(dataset.matchups).toEqual([]);
  });

  it("includes user-defined matchups while guide entries remain available through the engine", () => {
    const edited = { ...sampleMatchup, score: 3, explanation: "Editado localmente" };
    const dataset = buildDataset([edited]);

    expect(dataset.matchups[0]).toEqual(edited);
    expect(dataset.matchups).toHaveLength(1);
  });
});

describe("map brawler recommendations", () => {
  it("uses guide map highlights as defaults and allows user overrides", () => {
    const defaults = buildDataset([]);
    const doubleSwoosh = defaults.maps.find((map) => map.id === "double_swoosh")!;
    expect(doubleSwoosh.goodBrawlers.length).toBeGreaterThan(0);
    expect(getDefaultMapBrawlers("double_swoosh")).toEqual(doubleSwoosh.goodBrawlers);

    const edited = buildDataset([], {}, [], { double_swoosh: ["shelly"] });
    expect(edited.maps.find((map) => map.id === "double_swoosh")?.goodBrawlers).toEqual(["shelly"]);
  });

  it("keeps unique available brawlers and drops invalid map or brawler IDs", () => {
    expect(
      sanitizeCustomMapBrawlers({
        double_swoosh: ["shelly", "shelly", "unknown"],
        unknown_map: ["bull"],
      }),
    ).toEqual({ double_swoosh: ["shelly"] });
  });

  it("sanitizes map brawler tiers and applies them over map defaults", () => {
    expect(
      sanitizeCustomMapBrawlerTiers({
        double_swoosh: {
          shelly: "worst",
          bull: "neutral",
          unknown: "best",
          colt: "invalid",
        },
        unknown_map: { bull: "best" },
      }),
    ).toEqual({ double_swoosh: { shelly: "worst", bull: "neutral" } });

    const customized = buildDataset(
      [],
      {},
      [],
      {},
      {},
      { double_swoosh: { shelly: "best", colt: "worst" } },
    );
    const map = customized.maps.find((candidate) => candidate.id === "double_swoosh")!;
    expect(map.goodBrawlers).toContain("shelly");
    expect(map.goodBrawlers).not.toContain("colt");
  });

  it("uses guide mode recommendations and sanitizes custom mode lists", () => {
    expect(getDefaultModeBrawlers("gem_grab").length).toBeGreaterThan(0);
    expect(getDefaultModeBrawlers("invalid-mode")).toEqual([]);
    expect(
      sanitizeCustomModeBrawlers({
        gem_grab: ["shelly", "shelly", "unknown"],
        unknown_mode: ["bull"],
      }),
    ).toEqual({ gem_grab: ["shelly"] });
  });

  it("uses guide tier defaults and applies custom META tier overrides", () => {
    expect(getDefaultBrawlerTier("chester")).toBe("meta");
    const customized = buildDataset([], {}, [], {}, { chester: "none", amber: "meta" });
    expect(customized.brawlers.find((brawler) => brawler.id === "chester")).toMatchObject({
      meta: false,
      subMeta: false,
    });
    expect(customized.brawlers.find((brawler) => brawler.id === "amber")).toMatchObject({
      meta: true,
      subMeta: false,
    });
    expect(
      sanitizeCustomBrawlerTiers({
        chester: "none",
        amber: "meta",
        unknown: "meta",
        bull: "invalid",
      }),
    ).toEqual({ chester: "none", amber: "meta" });
  });
});

describe("custom matchup scores", () => {
  it("accepts advantage and disadvantage scores from +5 to -5", () => {
    expect(sanitizeCustomMatchups([{ ...sampleMatchup, score: 5 }])[0]?.score).toBe(5);
    expect(sanitizeCustomMatchups([{ ...sampleMatchup, score: -5 }])[0]?.score).toBe(-5);
    expect(sanitizeCustomMatchups([{ ...sampleMatchup, score: 6 }])).toEqual([]);
    expect(sanitizeCustomMatchups([{ ...sampleMatchup, score: -6 }])).toEqual([]);
  });

  it("accepts custom matchups without an explanation", () => {
    expect(sanitizeCustomMatchups([{ ...sampleMatchup, explanation: "" }])).toHaveLength(1);
  });

  it("rejects matchups that include unavailable brawlers", () => {
    expect(
      sanitizeCustomMatchups([
        { ...sampleMatchup, attacker: "lightyear-indisponivel" },
        { ...sampleMatchup, defender: "lightyear-indisponivel" },
      ]),
    ).toEqual([]);
  });
});

describe("custom matchup rule backups", () => {
  it("round-trips matchup, map, mode, and tier rules without exporting deleted base matchups", () => {
    const matchup = { ...sampleMatchup, score: 4, explanation: "Regra própria" };
    const mapBrawlers = { double_swoosh: ["shelly", "bull"] };
    const modeBrawlers = { gem_grab: ["shelly", "bull"] };
    const brawlerTiers = { amber: "none" as const, shelly: "subMeta" as const };
    const mapBrawlerTiers = {
      double_swoosh: { shelly: "worst" as const, bull: "neutral" as const },
    };
    const backup = createCustomRulesBackup(
      [matchup],
      ["belle->gene"],
      mapBrawlers,
      modeBrawlers,
      brawlerTiers,
      mapBrawlerTiers,
    );

    expect(parseCustomRulesBackup(JSON.parse(JSON.stringify(backup)))).toEqual(backup);
    expect(backup.mapBrawlers).toEqual(mapBrawlers);
    expect(backup.modeBrawlers).toEqual(modeBrawlers);
    expect(backup.brawlerTiers).toEqual(brawlerTiers);
    expect(backup.mapBrawlerTiers).toEqual(mapBrawlerTiers);
    expect(backup).not.toHaveProperty("deletedMatchups");
  });

  it("supports version 1 backups without map rules", () => {
    const legacyBackup = {
      ...createCustomRulesBackup([], []),
      version: 1,
      mapBrawlers: undefined,
      deletedMatchups: [matchupIdentity(sampleMatchup)],
    };

    const parsed = parseCustomRulesBackup(legacyBackup);
    expect(parsed).not.toHaveProperty("deletedMatchups");
    expect(parsed.mapBrawlers).toEqual({});
    expect(parsed.version).toBe(5);
    expect(parsed.modeBrawlers).toEqual({});
    expect(parsed.mapBrawlerTiers).toEqual({});
  });

  it("supports version 2 backups without mode rules", () => {
    const legacyBackup = {
      ...createCustomRulesBackup([], [], { double_swoosh: ["shelly"] }),
      version: 2,
      modeBrawlers: undefined,
    };

    const parsed = parseCustomRulesBackup(legacyBackup);
    expect(parsed.mapBrawlers).toEqual({ double_swoosh: ["shelly"] });
    expect(parsed.modeBrawlers).toEqual({});
  });

  it("supports version 3 backups without tier rules", () => {
    const legacyBackup = {
      ...createCustomRulesBackup([], []),
      version: 3,
      brawlerTiers: undefined,
    };

    expect(parseCustomRulesBackup(legacyBackup).brawlerTiers).toEqual({});
  });

  it("supports version 4 backups without map brawler tiers", () => {
    const legacyBackup = {
      ...createCustomRulesBackup([], []),
      version: 4,
      mapBrawlerTiers: undefined,
    };

    expect(parseCustomRulesBackup(legacyBackup).mapBrawlerTiers).toEqual({});
  });

  it("rejects incompatible files and invalid matchup entries", () => {
    expect(() => parseCustomRulesBackup({ format: "other", version: 1 })).toThrow(
      "Formato ou versão",
    );
    const backup = createCustomRulesBackup([{ ...sampleMatchup, attacker: "unknown-brawler" }], []);

    expect(() => parseCustomRulesBackup(backup)).toThrow("Há regras inválidas");
  });

  it("rejects invalid map rules in version 2 backups", () => {
    const backup = createCustomRulesBackup([], [], { unknown_map: ["shelly"] });

    expect(() => parseCustomRulesBackup(backup)).toThrow("regras de mapas inválidas");
  });
});

describe("restoring strategy guide matchups", () => {
  it("recognizes generic guide overrides but preserves context-specific custom matchups", () => {
    const guideOverride = {
      attacker: "belle",
      defender: "gene",
      score: 1,
      explanation: "Local edit",
      source: "manual",
      confidence: "media" as const,
      status: "avaliacao_manual" as const,
      reviewed: "2026-10-31",
    };

    expect(isGuideMatchupOverride(guideOverride)).toBe(true);
    expect(isGuideMatchupOverride({ ...guideOverride, mapId: "double_swoosh" })).toBe(false);
    expect(
      isGuideMatchupOverride({ ...guideOverride, attacker: "unknown", defender: "unknown" }),
    ).toBe(false);
  });
});

describe("draft setup stages", () => {
  it("requires starting, selecting a map, then choosing the coin before picks", () => {
    const setup = beginDraftFlow(EMPTY_DRAFT);
    expect(getDraftStage(setup)).toBe("map");
    expect(advanceToCoinSelection(setup)).toBe(setup);

    const mapped = {
      ...setup,
      mode: "gem_grab" as const,
      mapId: "double_swoosh",
    };
    const coinSelection = advanceToCoinSelection(mapped);
    expect(getDraftStage(coinSelection)).toBe("coin");

    const picking = beginPicks(coinSelection, "blue");
    expect(getDraftStage(picking)).toBe("picks");
    expect(picking.started).toBe(true);
    expect(getNextPickTeam(picking)).toBe("allies");
  });

  it("does not allow picks to start before map and coin selection", () => {
    expect(beginPicks(EMPTY_DRAFT, "blue")).toBe(EMPTY_DRAFT);
  });
});
