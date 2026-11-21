import { describe, expect, it } from "vitest";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS, MODES } from "@/data/maps";
import { SYNERGIES } from "@/data/matchups";
import {
  getGuideCounterTargets,
  getGuideEntry,
  getGuideHardCounterTargets,
  GUIDE_BY_BRAWLER_ID,
} from "@/data/strategy-guide";
import { predictCounters } from "./counterPrediction";
import { DEFAULT_WEIGHTS, rankCandidates, scoreCandidate } from "./engine";
import { guideMatchupKey, type Dataset, type DraftState } from "./types";

const dataset: Dataset = {
  brawlers: BRAWLERS,
  maps: MAPS,
  modes: MODES,
  matchups: [],
  synergies: SYNERGIES,
};

const datasetWithBrawlers = (ids: string[]): Dataset => ({
  ...dataset,
  brawlers: BRAWLERS.filter((brawler) => ids.includes(brawler.id)),
});

const candidateCounters = (candidateId: string, threatId: string) =>
  getGuideCounterTargets(candidateId).includes(threatId) ||
  getGuideHardCounterTargets(candidateId).includes(threatId);

describe("counter prediction", () => {
  it("awards one point per distinct available threat, up to three", () => {
    const prediction = predictCounters(
      datasetWithBrawlers(["8-bit", "colt", "barley", "dynamike", "bo"]),
      "colt",
      ["8-bit"],
      new Set(),
    );

    expect(prediction.threats.map((threat) => threat.id).sort()).toEqual(["barley", "dynamike"]);
    expect(prediction.bonus).toBe(2);
  });

  it("does not count the same threat twice for different allies", () => {
    const sharedThreat = Object.values(GUIDE_BY_BRAWLER_ID)
      .map((threat) => ({
        threatId: threat.id,
        allyIds: Object.values(GUIDE_BY_BRAWLER_ID)
          .filter((ally) => ally.hardCounters.includes(threat.id))
          .map((ally) => ally.id),
      }))
      .find(({ allyIds }) => allyIds.length >= 2)!;
    const selectedAllies = sharedThreat.allyIds.slice(0, 2);
    const candidateId = BRAWLERS.find(
      (candidate) =>
        !selectedAllies.includes(candidate.id) &&
        candidateCounters(candidate.id, sharedThreat.threatId),
    )!.id;
    const prediction = predictCounters(
      datasetWithBrawlers([...selectedAllies, sharedThreat.threatId, candidateId]),
      candidateId,
      selectedAllies,
      new Set(),
    );

    expect(prediction.bonus).toBe(1);
    expect(prediction.threats).toEqual([
      { id: sharedThreat.threatId, allyIds: selectedAllies },
    ]);
  });

  it("gives no bonus when a candidate counters none of the available threats", () => {
    const availableThreats = new Set(getGuideEntry("8-bit")!.hardCounters);
    const candidateId = BRAWLERS.find(
      (candidate) =>
        candidate.id !== "8-bit" &&
        candidate.available !== false &&
        !availableThreats.has(candidate.id) &&
        ![...availableThreats].some((threatId) => candidateCounters(candidate.id, threatId)),
    )!.id;
    const prediction = predictCounters(dataset, candidateId, ["8-bit"], new Set());

    expect(prediction).toEqual({ bonus: 0, threats: [] });
  });

  it("caps the bonus when a candidate counters four or more threats", () => {
    const candidate = BRAWLERS.find((brawler) => {
      if (brawler.available === false) return false;
      const prediction = predictCounters(dataset, brawler.id, ["8-bit"], new Set());
      return prediction.threats.length >= 4;
    });

    expect(candidate).toBeDefined();
    expect(predictCounters(dataset, candidate!.id, ["8-bit"], new Set()).bonus).toBe(3);
  });

  it("removes picked, banned, and unavailable threats from prediction", () => {
    const limitedDataset = datasetWithBrawlers(["8-bit", "colt", "barley", "dynamike", "bo"]);

    const picked = predictCounters(limitedDataset, "colt", ["8-bit"], new Set(["barley"]));
    const banned = predictCounters(limitedDataset, "colt", ["8-bit"], new Set(["dynamike"]));
    const unavailableDataset = {
      ...limitedDataset,
      brawlers: limitedDataset.brawlers.map((brawler) =>
        brawler.id === "dynamike" ? { ...brawler, available: false } : brawler,
      ),
    };
    const unavailable = predictCounters(unavailableDataset, "colt", ["8-bit"], new Set());

    expect(picked.threats.map((threat) => threat.id)).toEqual(["dynamike"]);
    expect(banned.threats.map((threat) => threat.id)).toEqual(["barley"]);
    expect(unavailable.threats.map((threat) => threat.id)).toEqual(["barley"]);
  });

  it("adds the bonus to scores and refreshes it for picks, bans, and removed allies", () => {
    const limitedDataset = datasetWithBrawlers(["8-bit", "colt", "barley", "dynamike", "bo"]);
    const draft: DraftState = {
      mode: null,
      mapId: null,
      allies: ["8-bit", null, null],
      enemies: [null, null, null],
    };
    const predicted = scoreCandidate(limitedDataset, "colt", draft);
    const withoutPrediction = scoreCandidate(
      {
        ...limitedDataset,
        disabledGuideMatchups: [
          guideMatchupKey("colt", "barley"),
          guideMatchupKey("colt", "dynamike"),
        ],
      },
      "colt",
      draft,
    );
    const withPickedThreat = scoreCandidate(limitedDataset, "colt", {
      ...draft,
      enemies: ["barley", null, null],
    });
    const withBannedThreat = scoreCandidate(
      limitedDataset,
      "colt",
      draft,
      undefined,
      undefined,
      true,
      ["barley"],
    );
    const withoutAlly = scoreCandidate(limitedDataset, "colt", {
      ...draft,
      allies: [null, null, null],
    });
    const weightedBase =
      Math.round(
        (Object.keys(DEFAULT_WEIGHTS) as (keyof typeof DEFAULT_WEIGHTS)[]).reduce(
          (total, component) => total + predicted.components[component] * DEFAULT_WEIGHTS[component],
          0,
        ) * 100,
      ) + predicted.strategicPoints;

    expect(predicted.counterPredictionBonus).toBe(2);
    expect(predicted.score - withoutPrediction.score).toBe(2);
    expect(predicted.score).toBe(weightedBase + predicted.counterPredictionBonus);
    expect(withPickedThreat.counterPredictionBonus).toBe(1);
    expect(withBannedThreat.counterPredictionBonus).toBe(1);
    expect(withoutAlly.counterPredictionBonus).toBe(0);
    expect(
      rankCandidates(limitedDataset, {
        ...draft,
        enemies: ["colt", null, null],
      }).some((candidate) => candidate.id === "colt"),
    ).toBe(false);
  });

  it("honors disabled guide matchups without changing guide entries", () => {
    const disabledDataset = {
      ...datasetWithBrawlers(["8-bit", "colt", "barley", "dynamike", "bo"]),
      disabledGuideMatchups: [guideMatchupKey("colt", "barley")],
    };
    const prediction = predictCounters(disabledDataset, "colt", ["8-bit"], new Set());

    expect(prediction.threats.map((threat) => threat.id)).toEqual(["dynamike"]);
    expect(GUIDE_BY_BRAWLER_ID["8-bit"]?.meta).toBe(false);
  });

  it("disables prediction when all opposing picks are already selected", () => {
    const draft: DraftState = {
      mode: null,
      mapId: null,
      allies: ["8-bit", null, null],
      enemies: ["shelly", "stu", "nita"],
    };

    expect(predictCounters(dataset, "colt", ["8-bit"], new Set()).bonus).toBeGreaterThan(0);
    expect(scoreCandidate(dataset, "colt", draft).counterPredictionBonus).toBe(0);
  });
});
