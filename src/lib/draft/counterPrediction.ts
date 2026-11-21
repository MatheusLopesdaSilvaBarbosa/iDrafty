import {
  getGuideCounterTargets,
  getGuideEntry,
  getGuideHardCounterTargets,
} from "@/data/strategy-guide";
import { guideMatchupKey, type Dataset } from "./types";

export const COUNTER_PREDICTION_POINTS_PER_THREAT = 1;
export const MAX_COUNTER_PREDICTION_BONUS = 3;

export interface CounterPredictionThreat {
  id: string;
  allyIds: string[];
}

export interface CounterPredictionResult {
  bonus: number;
  threats: CounterPredictionThreat[];
}

export function predictCounters(
  ds: Dataset,
  candidateId: string,
  allyIds: string[],
  unavailableIds: ReadonlySet<string>,
): CounterPredictionResult {
  const availableBrawlerIds = new Set(
    ds.brawlers
      .filter((brawler) => brawler.available !== false)
      .map((brawler) => brawler.id),
  );
  const potentialThreats = new Map<string, Set<string>>();

  allyIds.forEach((allyId) => {
    getGuideEntry(allyId)?.hardCounters.forEach((threatId) => {
      if (!threatId || unavailableIds.has(threatId) || !availableBrawlerIds.has(threatId)) return;
      const sources = potentialThreats.get(threatId) ?? new Set<string>();
      sources.add(allyId);
      potentialThreats.set(threatId, sources);
    });
  });

  const candidateCounters = new Set([
    ...getGuideCounterTargets(candidateId),
    ...getGuideHardCounterTargets(candidateId),
  ]);
  const threats = [...potentialThreats].flatMap(([threatId, sources]) => {
    const disabled =
      ds.disabledGuideMatchups?.includes(guideMatchupKey(candidateId, threatId)) ||
      ds.disabledGuideMatchups?.includes(guideMatchupKey(threatId, candidateId));
    if (!candidateCounters.has(threatId) || disabled) return [];
    return [{ id: threatId, allyIds: [...sources] }];
  });
  const bonus = Math.min(
    threats.length * COUNTER_PREDICTION_POINTS_PER_THREAT,
    MAX_COUNTER_PREDICTION_BONUS,
  );

  return { bonus, threats };
}
