import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS, MODES } from "@/data/maps";
import { SYNERGIES } from "@/data/matchups";
import { getGuideEntry, getMatchupGuideEntry } from "@/data/strategy-guide";
import { guideMatchupKey } from "./types";
import type {
  Brawler,
  Dataset,
  DraftCoin,
  DraftStage,
  DraftState,
  Matchup,
  ModeId,
  StrategicTier,
} from "./types";

const DRAFT_KEY = "draftiq.draft.v1";
const CUSTOM_KEY = "draftiq.custom-matchups.v1";
const DELETED_GUIDE_MATCHUPS_KEY = "draftiq.deleted-guide-matchups.v1";
const BANNED_KEY = "draftiq.banned-brawlers.v1";
const BRAWLER_NOTES_KEY = "draftiq.brawler-notes.v1";
const MAP_BRAWLERS_KEY = "draftiq.map-brawlers.v1";
const MODE_BRAWLERS_KEY = "draftiq.mode-brawlers.v1";
const BRAWLER_TIERS_KEY = "draftiq.brawler-tiers.v1";
const MAP_BRAWLER_TIERS_KEY = "draftiq.map-brawler-tiers.v1";
const DISABLED_MAPS_KEY = "draftiq.disabled-maps.v1";

type BrawlerNotes = Pick<Brawler, "strengths" | "weaknesses">;
type CustomBrawlerNotes = Record<string, BrawlerNotes>;
type CustomMapBrawlers = Record<string, string[]>;
type CustomModeBrawlers = Record<string, string[]>;
type CustomBrawlerTiers = Record<string, StrategicTier>;
type MapBrawlerTier = "neutral" | "best" | "worst";
type CustomMapBrawlerTiers = Record<string, Record<string, MapBrawlerTier>>;

export interface CustomRulesBackup {
  format: "draftiq-custom-rules";
  version: 5;
  exportedAt: string;
  matchups: Matchup[];
  deletedGuideMatchups: string[];
  mapBrawlers: CustomMapBrawlers;
  modeBrawlers: CustomModeBrawlers;
  brawlerTiers: CustomBrawlerTiers;
  mapBrawlerTiers: CustomMapBrawlerTiers;
}

export function matchupIdentity(
  matchup: Pick<Matchup, "attacker" | "defender" | "mapId" | "mode">,
) {
  return JSON.stringify([
    matchup.attacker,
    matchup.defender,
    matchup.mapId ?? null,
    matchup.mode ?? null,
  ]);
}

export function isGuideMatchupOverride(matchup: Matchup) {
  if (matchup.mapId || matchup.mode) return false;
  const attacker = getMatchupGuideEntry(matchup.attacker);
  const defender = getMatchupGuideEntry(matchup.defender);
  return Boolean(
    attacker?.counteredBy.includes(matchup.defender) ||
    attacker?.hardCounters.includes(matchup.defender) ||
    defender?.counteredBy.includes(matchup.attacker) ||
    defender?.hardCounters.includes(matchup.attacker),
  );
}

export const EMPTY_DRAFT: DraftState = {
  coin: null,
  started: false,
  stage: "start",
  mode: null,
  mapId: null,
  allies: [null, null, null],
  enemies: [null, null, null],
};

const DRAFT_STAGES = new Set<DraftStage>(["start", "map", "coin", "picks"]);

export function getDraftStage(draft: DraftState): DraftStage {
  if (draft.stage && DRAFT_STAGES.has(draft.stage)) return draft.stage;
  return draft.started ? "picks" : draft.mapId ? "coin" : "start";
}

export function beginDraftFlow(draft: DraftState): DraftState {
  return { ...draft, coin: null, started: false, stage: "map" };
}

export function advanceToCoinSelection(draft: DraftState): DraftState {
  if (getDraftStage(draft) !== "map" || !draft.mode || !draft.mapId) return draft;
  return { ...draft, stage: "coin" };
}

export function beginPicks(draft: DraftState, coin: DraftCoin): DraftState {
  if (getDraftStage(draft) !== "coin" || !draft.mode || !draft.mapId) return draft;
  return {
    ...draft,
    coin,
    started: true,
    stage: "picks",
    allies: [null, null, null],
    enemies: [null, null, null],
  };
}

/** Pick order for the six-pick ranked draft. */
export function getPickOrder(coin: DraftCoin | null | undefined): ("allies" | "enemies")[] {
  if (coin === "blue") return ["allies", "enemies", "enemies", "allies", "allies", "enemies"];
  if (coin === "red") return ["enemies", "allies", "allies", "enemies", "enemies", "allies"];
  return [];
}

export function getNextPickTeam(draft: DraftState): "allies" | "enemies" | null {
  if (!draft.started || !draft.coin) return null;
  const completed = [...draft.allies, ...draft.enemies].filter(Boolean).length;
  return getPickOrder(draft.coin)[completed] ?? null;
}

export function undoLastPick(draft: DraftState): DraftState {
  if (!draft.started || !draft.coin) return draft;
  const completed = [...draft.allies, ...draft.enemies].filter(Boolean).length;
  const lastTeam = getPickOrder(draft.coin)[completed - 1];
  if (!lastTeam) return draft;
  let lastSlot = -1;
  for (let i = draft[lastTeam].length - 1; i >= 0; i--) {
    if (draft[lastTeam][i] !== null) {
      lastSlot = i;
      break;
    }
  }
  if (lastSlot === -1) return draft;
  const picks = [...draft[lastTeam]];
  picks[lastSlot] = null;
  return { ...draft, [lastTeam]: picks };
}

const BRAWLER_IDS = new Set(BRAWLERS.map((b) => b.id));
const MODE_IDS = new Set(MODES.map((m) => m.id));
const MAP_IDS = new Set(MAPS.map((m) => m.id));
const CONFIDENCE_VALUES = new Set(["baixa", "media", "alta"]);
const STATUS_VALUES = new Set([
  "confirmado",
  "fonte_externa",
  "avaliacao_manual",
  "estimativa",
  "nao_verificado",
]);

function sanitizeSlots(value: unknown, taken: Set<string>): (string | null)[] {
  const slots = Array.isArray(value) ? value : [];
  return [0, 1, 2].map((i) => {
    const id = slots[i];
    if (
      typeof id !== "string" ||
      !BRAWLER_IDS.has(id) ||
      BRAWLERS.find((b) => b.id === id)?.available === false ||
      taken.has(id)
    )
      return null;
    taken.add(id);
    return id;
  });
}

function sanitizeDraft(value: unknown): DraftState {
  const raw = value && typeof value === "object" ? (value as Partial<DraftState>) : {};
  const taken = new Set<string>();
  const allies = sanitizeSlots(raw.allies, taken);
  const enemies = sanitizeSlots(raw.enemies, taken);
  const mode =
    typeof raw.mode === "string" && MODE_IDS.has(raw.mode as ModeId) ? (raw.mode as ModeId) : null;
  const requestedMap = typeof raw.mapId === "string" && MAP_IDS.has(raw.mapId) ? raw.mapId : null;
  const map = requestedMap ? MAPS.find((m) => m.id === requestedMap) : undefined;
  const mapId = map && (!mode || map.mode === mode) ? map.id : null;
  const coin = raw.coin === "blue" || raw.coin === "red" ? raw.coin : null;
  const savedStage =
    typeof raw.stage === "string" && DRAFT_STAGES.has(raw.stage as DraftStage)
      ? (raw.stage as DraftStage)
      : null;
  const stage =
    savedStage ??
    (raw.started === true && coin !== null ? "picks" : mapId ? "coin" : mode ? "map" : "start");
  const started = stage === "picks" && coin !== null;
  return { coin, started, stage, mode: mapId ? map!.mode : mode, mapId, allies, enemies };
}

export function sanitizeBannedBrawlers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string =>
          typeof id === "string" &&
          BRAWLER_IDS.has(id) &&
          BRAWLERS.find((brawler) => brawler.id === id)?.available !== false,
      ),
    ),
  ];
}

export function sanitizeDisabledMaps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id): id is string => typeof id === "string" && MAP_IDS.has(id))),
  ];
}

export function sanitizeCustomMatchups(value: unknown): Matchup[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is Matchup => {
    if (!x || typeof x !== "object") return false;
    const m = x as Partial<Matchup>;
    return (
      typeof m.attacker === "string" &&
      BRAWLER_IDS.has(m.attacker) &&
      BRAWLERS.find((brawler) => brawler.id === m.attacker)?.available !== false &&
      typeof m.defender === "string" &&
      BRAWLER_IDS.has(m.defender) &&
      BRAWLERS.find((brawler) => brawler.id === m.defender)?.available !== false &&
      m.attacker !== m.defender &&
      typeof m.score === "number" &&
      Number.isInteger(m.score) &&
      m.score >= -5 &&
      m.score <= 5 &&
      typeof m.explanation === "string" &&
      typeof m.source === "string" &&
      typeof m.reviewed === "string" &&
      typeof m.confidence === "string" &&
      CONFIDENCE_VALUES.has(m.confidence) &&
      typeof m.status === "string" &&
      STATUS_VALUES.has(m.status) &&
      (m.mapId === undefined || (typeof m.mapId === "string" && MAP_IDS.has(m.mapId))) &&
      (m.mode === undefined || (typeof m.mode === "string" && MODE_IDS.has(m.mode as ModeId)))
    );
  });
}

function sanitizeDeletedGuideMatchups(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((key): key is string => {
        if (typeof key !== "string") return false;
        const [attacker, defender] = key.split("->");
        return (
          !!attacker &&
          !!defender &&
          attacker !== defender &&
          BRAWLER_IDS.has(attacker) &&
          BRAWLER_IDS.has(defender)
        );
      }),
    ),
  ];
}

export function createCustomRulesBackup(
  matchups: Matchup[],
  deletedGuideMatchups: string[],
  mapBrawlers: CustomMapBrawlers = {},
  modeBrawlers: CustomModeBrawlers = {},
  brawlerTiers: CustomBrawlerTiers = {},
  mapBrawlerTiers: CustomMapBrawlerTiers = {},
): CustomRulesBackup {
  return {
    format: "draftiq-custom-rules",
    version: 5,
    exportedAt: new Date().toISOString(),
    matchups,
    deletedGuideMatchups,
    mapBrawlers,
    modeBrawlers,
    brawlerTiers,
    mapBrawlerTiers,
  };
}

export function parseCustomRulesBackup(value: unknown): CustomRulesBackup {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("O texto não contém um pacote de regras IDrafty.");
  }

  const backup = value as {
    format?: unknown;
    version?: unknown;
    exportedAt?: unknown;
    matchups?: unknown;
    deletedGuideMatchups?: unknown;
    mapBrawlers?: unknown;
    modeBrawlers?: unknown;
    brawlerTiers?: unknown;
    mapBrawlerTiers?: unknown;
  };
  if (
    backup.format !== "draftiq-custom-rules" ||
    (backup.version !== 1 &&
      backup.version !== 2 &&
      backup.version !== 3 &&
      backup.version !== 4 &&
      backup.version !== 5)
  ) {
    throw new Error("Formato ou versão do JSON não são compatíveis.");
  }
  if (typeof backup.exportedAt !== "string" || Number.isNaN(Date.parse(backup.exportedAt))) {
    throw new Error("A data de exportação do JSON é inválida.");
  }
  if (!Array.isArray(backup.matchups) || !Array.isArray(backup.deletedGuideMatchups)) {
    throw new Error("O texto está incompleto ou possui listas inválidas.");
  }
  if (backup.version === 2 && (!backup.mapBrawlers || typeof backup.mapBrawlers !== "object")) {
    throw new Error("O texto está incompleto ou possui listas inválidas.");
  }
  if (
    (backup.version === 3 || backup.version === 4 || backup.version === 5) &&
    (!backup.mapBrawlers ||
      typeof backup.mapBrawlers !== "object" ||
      !backup.modeBrawlers ||
      typeof backup.modeBrawlers !== "object" ||
      (backup.version >= 4 && (!backup.brawlerTiers || typeof backup.brawlerTiers !== "object")) ||
      (backup.version === 5 &&
        (!backup.mapBrawlerTiers || typeof backup.mapBrawlerTiers !== "object")))
  ) {
    throw new Error("O texto está incompleto ou possui listas inválidas.");
  }

  const matchups = sanitizeCustomMatchups(backup.matchups);
  if (matchups.length !== backup.matchups.length) {
    throw new Error("Há regras inválidas: confira Brawlers, mapas, notas e justificativas.");
  }
  const matchupIds = matchups.map(matchupIdentity);
  if (new Set(matchupIds).size !== matchupIds.length) {
    throw new Error("O JSON contém regras de matchup duplicadas.");
  }

  const deletedGuideMatchups = sanitizeDeletedGuideMatchups(backup.deletedGuideMatchups);
  if (deletedGuideMatchups.length !== backup.deletedGuideMatchups.length) {
    throw new Error("O texto contém exclusões inválidas ou duplicadas.");
  }

  const mapBrawlers = sanitizeCustomMapBrawlers(backup.mapBrawlers ?? {});
  if (JSON.stringify(mapBrawlers) !== JSON.stringify(backup.mapBrawlers ?? {})) {
    throw new Error("Há regras de mapas inválidas: confira os mapas e os brawlers selecionados.");
  }
  const modeBrawlers = sanitizeCustomModeBrawlers(backup.modeBrawlers ?? {});
  if (JSON.stringify(modeBrawlers) !== JSON.stringify(backup.modeBrawlers ?? {})) {
    throw new Error("Há regras de modos inválidas: confira os modos e os brawlers selecionados.");
  }
  const brawlerTiers = sanitizeCustomBrawlerTiers(backup.brawlerTiers ?? {});
  if (JSON.stringify(brawlerTiers) !== JSON.stringify(backup.brawlerTiers ?? {})) {
    throw new Error("Há classificações de brawlers inválidas.");
  }
  const mapBrawlerTiers = sanitizeCustomMapBrawlerTiers(backup.mapBrawlerTiers ?? {});
  if (JSON.stringify(mapBrawlerTiers) !== JSON.stringify(backup.mapBrawlerTiers ?? {})) {
    throw new Error("Há classificações de brawlers por mapa inválidas.");
  }

  return {
    format: "draftiq-custom-rules",
    version: 5,
    exportedAt: backup.exportedAt,
    matchups,
    deletedGuideMatchups,
    mapBrawlers,
    modeBrawlers,
    brawlerTiers,
    mapBrawlerTiers,
  };
}

function sanitizeCustomBrawlerNotes(value: unknown): CustomBrawlerNotes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([id, notes]) => {
      if (!BRAWLER_IDS.has(id) || !notes || typeof notes !== "object") return [];
      const { strengths, weaknesses } = notes as Partial<BrawlerNotes>;
      if (
        !Array.isArray(strengths) ||
        !strengths.every((item) => typeof item === "string") ||
        !Array.isArray(weaknesses) ||
        !weaknesses.every((item) => typeof item === "string")
      )
        return [];
      return [[id, { strengths, weaknesses }]];
    }),
  );
}

export function sanitizeCustomMapBrawlers(value: unknown): CustomMapBrawlers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([mapId, brawlerIds]) => {
      if (!MAP_IDS.has(mapId) || !Array.isArray(brawlerIds)) return [];
      const validIds = brawlerIds.filter(
        (id): id is string =>
          typeof id === "string" &&
          BRAWLER_IDS.has(id) &&
          BRAWLERS.find((brawler) => brawler.id === id)?.available !== false,
      );
      return [[mapId, [...new Set(validIds)]]];
    }),
  );
}

export function sanitizeCustomMapBrawlerTiers(value: unknown): CustomMapBrawlerTiers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([mapId, tiers]) => {
      if (!MAP_IDS.has(mapId) || !tiers || typeof tiers !== "object" || Array.isArray(tiers))
        return [];
      const validTiers = Object.fromEntries(
        Object.entries(tiers).flatMap(([brawlerId, tier]) =>
          BRAWLER_IDS.has(brawlerId) &&
          BRAWLERS.find((brawler) => brawler.id === brawlerId)?.available !== false &&
          (tier === "neutral" || tier === "best" || tier === "worst")
            ? [[brawlerId, tier]]
            : [],
        ),
      );
      return [[mapId, validTiers]];
    }),
  );
}

export function sanitizeCustomModeBrawlers(value: unknown): CustomModeBrawlers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([modeId, brawlerIds]) => {
      if (!MODE_IDS.has(modeId as ModeId) || !Array.isArray(brawlerIds)) return [];
      const validIds = brawlerIds.filter(
        (id): id is string =>
          typeof id === "string" &&
          BRAWLER_IDS.has(id) &&
          BRAWLERS.find((brawler) => brawler.id === id)?.available !== false,
      );
      return [[modeId, [...new Set(validIds)]]];
    }),
  );
}

export function sanitizeCustomBrawlerTiers(value: unknown): CustomBrawlerTiers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, tier]): tier is StrategicTier =>
        BRAWLER_IDS.has(id) && (tier === "meta" || tier === "subMeta" || tier === "none"),
    ),
  );
}

export function getDefaultBrawlerTier(id: string): StrategicTier {
  const entry = getGuideEntry(id);
  if (entry?.meta) return "meta";
  if (entry?.subMeta) return "subMeta";
  return "none";
}

export function getDefaultMapBrawlers(mapId: string): string[] {
  const map = MAPS.find((candidate) => candidate.id === mapId);
  if (!map) return [];
  const guideBrawlers = BRAWLERS.filter(
    (brawler) => brawler.available !== false && getGuideEntry(brawler.id)?.maps.includes(mapId),
  ).map((brawler) => brawler.id);
  return [...new Set([...map.goodBrawlers, ...guideBrawlers])].filter(
    (id) => BRAWLERS.find((brawler) => brawler.id === id)?.available !== false,
  );
}

function getDefaultMapBrawlerTier(
  mapId: string,
  brawlerId: string,
  mapBrawlers?: string[],
): MapBrawlerTier {
  if ((mapBrawlers ?? getDefaultMapBrawlers(mapId)).includes(brawlerId)) return "best";
  if (getGuideEntry(brawlerId)?.worstMaps.includes(mapId)) return "worst";
  return "neutral";
}

const GUIDE_MODE_ALIASES: Record<string, ModeId> = {
  gemgrab: "gem_grab",
  brawlball: "brawl_ball",
  heist: "heist",
  hotzone: "hot_zone",
  knockout: "knockout",
  bounty: "bounty",
};

function getGuideModeId(mode: string): ModeId | undefined {
  return GUIDE_MODE_ALIASES[mode.toLowerCase().replace(/[^a-z0-9]/g, "")];
}

export function getDefaultModeBrawlers(modeId: string): string[] {
  if (!MODE_IDS.has(modeId as ModeId)) return [];
  return BRAWLERS.filter((brawler) => {
    if (brawler.available === false) return false;
    return getGuideEntry(brawler.id)?.bestModes.some((mode) => getGuideModeId(mode) === modeId);
  })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((brawler) => brawler.id);
}

/** Structured matchups are user-defined; guide matchups are resolved by the engine fallback. */
export function buildDataset(
  custom: Matchup[],
  customBrawlerNotes: CustomBrawlerNotes = {},
  deletedGuideMatchups: string[] = [],
  customMapBrawlers: CustomMapBrawlers = {},
  customBrawlerTiers: CustomBrawlerTiers = {},
  customMapBrawlerTiers: CustomMapBrawlerTiers = {},
  customModeBrawlers: CustomModeBrawlers = {},
): Dataset {
  const brawlers = BRAWLERS.map((brawler) => {
    const notes = customBrawlerNotes[brawler.id];
    const tier = customBrawlerTiers[brawler.id] ?? getDefaultBrawlerTier(brawler.id);
    return {
      ...brawler,
      ...(notes ?? {}),
      meta: tier === "meta",
      subMeta: tier === "subMeta",
    };
  });
  return {
    brawlers,
    maps: MAPS.map((map) => {
      const mapTiers = customMapBrawlerTiers[map.id] ?? {};
      const goodBrawlers = new Set(customMapBrawlers[map.id] ?? getDefaultMapBrawlers(map.id));
      Object.entries(mapTiers).forEach(([brawlerId, tier]) => {
        if (tier === "best") goodBrawlers.add(brawlerId);
        else goodBrawlers.delete(brawlerId);
      });
      const brawlerTiers = Object.fromEntries(
        BRAWLERS.filter((brawler) => brawler.available !== false).flatMap(
          (brawler): [string, MapBrawlerTier][] => {
            const tier = mapTiers[brawler.id];
            if (tier) return [[brawler.id, tier]];
            if (goodBrawlers.has(brawler.id)) return [[brawler.id, "best"]];
            if (getGuideEntry(brawler.id)?.worstMaps.includes(map.id))
              return [[brawler.id, "worst"]];
            if (getGuideEntry(brawler.id)?.maps.includes(map.id)) return [[brawler.id, "neutral"]];
            return [];
          },
        ),
      ) as Record<string, MapBrawlerTier>;
      return { ...map, goodBrawlers: [...goodBrawlers], brawlerTiers };
    }),
    modes: MODES.map((mode) => ({
      ...mode,
      recommendedBrawlers: Object.prototype.hasOwnProperty.call(customModeBrawlers, mode.id)
        ? (customModeBrawlers[mode.id] ?? [])
        : getDefaultModeBrawlers(mode.id),
    })),
    synergies: SYNERGIES,
    disabledGuideMatchups: deletedGuideMatchups,
    matchups: custom,
  };
}

type Team = "allies" | "enemies";
interface Ctx {
  draft: DraftState;
  bannedBrawlers: string[];
  disabledMapIds: string[];
  ds: Dataset;
  custom: Matchup[];
  deletedGuideMatchups: string[];
  mapBrawlerOverrides: CustomMapBrawlers;
  mapBrawlerTierOverrides: CustomMapBrawlerTiers;
  modeBrawlerOverrides: CustomModeBrawlers;
  brawlerTierOverrides: CustomBrawlerTiers;
  updateBrawlerNotes: (id: string, notes: BrawlerNotes) => void;
  setMapGoodBrawlers: (mapId: string, brawlerIds: string[]) => void;
  toggleMapRotation: (mapId: string) => void;
  setMapBrawlerTier: (mapId: string, brawlerId: string, tier: MapBrawlerTier) => void;
  resetMapGoodBrawlers: (mapId: string) => void;
  setModeGoodBrawlers: (modeId: string, brawlerIds: string[]) => void;
  resetModeGoodBrawlers: (modeId: string) => void;
  setBrawlerTier: (brawlerId: string, tier: StrategicTier) => void;
  setMode: (m: ModeId | null) => void;
  setMap: (id: string | null) => void;
  setSlot: (team: Team, i: number, id: string | null) => void;
  undoPick: () => void;
  toggleBan: (id: string) => void;
  beginFlow: () => void;
  continueToCoin: () => void;
  backToMap: () => void;
  reset: () => void;
  startDraft: (coin: DraftCoin) => void;
  addCustom: (m: Matchup) => void;
  importCustomRules: (backup: CustomRulesBackup) => void;
  removeCustom: (i: number) => void;
  deleteMatchup: (matchup: Matchup, fromGuide?: boolean) => void;
  restoreGuideMatchups: () => void;
}
const DraftCtx = createContext<Ctx | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [bannedBrawlers, setBannedBrawlers] = useState<string[]>([]);
  const [disabledMapIds, setDisabledMapIds] = useState<string[]>([]);
  const [custom, setCustom] = useState<Matchup[]>([]);
  const [deletedGuideMatchups, setDeletedGuideMatchups] = useState<string[]>([]);
  const [customBrawlerNotes, setCustomBrawlerNotes] = useState<CustomBrawlerNotes>({});
  const [customMapBrawlers, setCustomMapBrawlers] = useState<CustomMapBrawlers>({});
  const [customMapBrawlerTiers, setCustomMapBrawlerTiers] = useState<CustomMapBrawlerTiers>({});
  const [customModeBrawlers, setCustomModeBrawlers] = useState<CustomModeBrawlers>({});
  const [customBrawlerTiers, setCustomBrawlerTiers] = useState<CustomBrawlerTiers>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) setDraft(sanitizeDraft(JSON.parse(d)));
      const c = localStorage.getItem(CUSTOM_KEY);
      if (c) setCustom(sanitizeCustomMatchups(JSON.parse(c)));
      const deletedGuide = localStorage.getItem(DELETED_GUIDE_MATCHUPS_KEY);
      if (deletedGuide)
        setDeletedGuideMatchups(sanitizeDeletedGuideMatchups(JSON.parse(deletedGuide)));
      const b = localStorage.getItem(BANNED_KEY);
      if (b) setBannedBrawlers(sanitizeBannedBrawlers(JSON.parse(b)));
      const disabledMaps = localStorage.getItem(DISABLED_MAPS_KEY);
      if (disabledMaps) setDisabledMapIds(sanitizeDisabledMaps(JSON.parse(disabledMaps)));
      const notes = localStorage.getItem(BRAWLER_NOTES_KEY);
      if (notes) setCustomBrawlerNotes(sanitizeCustomBrawlerNotes(JSON.parse(notes)));
      const mapBrawlers = localStorage.getItem(MAP_BRAWLERS_KEY);
      if (mapBrawlers) setCustomMapBrawlers(sanitizeCustomMapBrawlers(JSON.parse(mapBrawlers)));
      const mapBrawlerTiers = localStorage.getItem(MAP_BRAWLER_TIERS_KEY);
      if (mapBrawlerTiers)
        setCustomMapBrawlerTiers(sanitizeCustomMapBrawlerTiers(JSON.parse(mapBrawlerTiers)));
      const modeBrawlers = localStorage.getItem(MODE_BRAWLERS_KEY);
      if (modeBrawlers) setCustomModeBrawlers(sanitizeCustomModeBrawlers(JSON.parse(modeBrawlers)));
      const brawlerTiers = localStorage.getItem(BRAWLER_TIERS_KEY);
      if (brawlerTiers) setCustomBrawlerTiers(sanitizeCustomBrawlerTiers(JSON.parse(brawlerTiers)));
    } catch {
      // Damaged or outdated localStorage must not prevent the app from opening.
      setDraft(EMPTY_DRAFT);
      setBannedBrawlers([]);
      setDisabledMapIds([]);
      setCustom([]);
      setDeletedGuideMatchups([]);
      setCustomBrawlerNotes({});
      setCustomMapBrawlers({});
      setCustomMapBrawlerTiers({});
      setCustomModeBrawlers({});
      setCustomBrawlerTiers({});
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(BANNED_KEY, JSON.stringify(bannedBrawlers));
  }, [bannedBrawlers, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(DISABLED_MAPS_KEY, JSON.stringify(disabledMapIds));
  }, [disabledMapIds, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  }, [custom, ready]);
  useEffect(() => {
    if (ready)
      localStorage.setItem(DELETED_GUIDE_MATCHUPS_KEY, JSON.stringify(deletedGuideMatchups));
  }, [deletedGuideMatchups, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(BRAWLER_NOTES_KEY, JSON.stringify(customBrawlerNotes));
  }, [customBrawlerNotes, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(MAP_BRAWLERS_KEY, JSON.stringify(customMapBrawlers));
  }, [customMapBrawlers, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(MAP_BRAWLER_TIERS_KEY, JSON.stringify(customMapBrawlerTiers));
  }, [customMapBrawlerTiers, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(MODE_BRAWLERS_KEY, JSON.stringify(customModeBrawlers));
  }, [customModeBrawlers, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(BRAWLER_TIERS_KEY, JSON.stringify(customBrawlerTiers));
  }, [customBrawlerTiers, ready]);

  const setSlot = useCallback(
    (team: Team, i: number, id: string | null) => {
      if (
        !Number.isInteger(i) ||
        i < 0 ||
        i > 2 ||
        id === null ||
        bannedBrawlers.includes(id) ||
        !BRAWLER_IDS.has(id) ||
        BRAWLERS.find((b) => b.id === id)?.available === false
      )
        return;
      setDraft((d) => {
        // The pick order is enforced by state, not only by the UI.
        if (!d.started || getNextPickTeam(d) !== team) return d;
        const nextOpenSlot = d[team].findIndex((x) => x === null);
        if (nextOpenSlot !== i) return d;
        // No duplicates across the whole draft.
        if ([...d.allies, ...d.enemies].includes(id)) return d;
        const next = [...d[team]];
        next[i] = id;
        return { ...d, [team]: next };
      });
    },
    [bannedBrawlers],
  );

  const toggleBan = useCallback((id: string) => {
    if (!BRAWLER_IDS.has(id) || BRAWLERS.find((brawler) => brawler.id === id)?.available === false)
      return;
    setBannedBrawlers((banned) =>
      banned.includes(id) ? banned.filter((brawlerId) => brawlerId !== id) : [...banned, id],
    );
  }, []);

  const updateBrawlerNotes = useCallback((id: string, notes: BrawlerNotes) => {
    if (!BRAWLER_IDS.has(id)) return;
    setCustomBrawlerNotes((current) => ({ ...current, [id]: notes }));
  }, []);

  const setMapGoodBrawlers = useCallback((mapId: string, brawlerIds: string[]) => {
    if (!MAP_IDS.has(mapId)) return;
    const validIds = sanitizeCustomMapBrawlers({ [mapId]: brawlerIds })[mapId] ?? [];
    setCustomMapBrawlers((current) => ({ ...current, [mapId]: validIds }));
  }, []);
  const toggleMapRotation = useCallback((mapId: string) => {
    if (!MAP_IDS.has(mapId)) return;
    setDisabledMapIds((current) =>
      current.includes(mapId) ? current.filter((id) => id !== mapId) : [...current, mapId],
    );
  }, []);
  const setMapBrawlerTier = useCallback(
    (mapId: string, brawlerId: string, tier: MapBrawlerTier) => {
      if (
        !MAP_IDS.has(mapId) ||
        !BRAWLER_IDS.has(brawlerId) ||
        BRAWLERS.find((brawler) => brawler.id === brawlerId)?.available === false
      )
        return;
      setCustomMapBrawlerTiers((current) => {
        const mapTiers = { ...current[mapId] };
        if (tier === getDefaultMapBrawlerTier(mapId, brawlerId, customMapBrawlers[mapId])) {
          delete mapTiers[brawlerId];
        } else {
          mapTiers[brawlerId] = tier;
        }
        if (Object.keys(mapTiers).length === 0) {
          const next = { ...current };
          delete next[mapId];
          return next;
        }
        return { ...current, [mapId]: mapTiers };
      });
    },
    [customMapBrawlers],
  );
  const resetMapGoodBrawlers = useCallback((mapId: string) => {
    if (!MAP_IDS.has(mapId)) return;
    setCustomMapBrawlers((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, mapId)) return current;
      return Object.fromEntries(Object.entries(current).filter(([id]) => id !== mapId));
    });
    setCustomMapBrawlerTiers((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, mapId)) return current;
      return Object.fromEntries(Object.entries(current).filter(([id]) => id !== mapId));
    });
  }, []);
  const setModeGoodBrawlers = useCallback((modeId: string, brawlerIds: string[]) => {
    if (!MODE_IDS.has(modeId as ModeId)) return;
    const validIds = sanitizeCustomModeBrawlers({ [modeId]: brawlerIds })[modeId] ?? [];
    setCustomModeBrawlers((current) => ({ ...current, [modeId]: validIds }));
  }, []);
  const resetModeGoodBrawlers = useCallback((modeId: string) => {
    if (!MODE_IDS.has(modeId as ModeId)) return;
    setCustomModeBrawlers((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, modeId)) return current;
      return Object.fromEntries(Object.entries(current).filter(([id]) => id !== modeId));
    });
  }, []);
  const setBrawlerTier = useCallback((brawlerId: string, tier: StrategicTier) => {
    if (!BRAWLER_IDS.has(brawlerId)) return;
    setCustomBrawlerTiers((current) => {
      if (tier === getDefaultBrawlerTier(brawlerId)) {
        if (!Object.prototype.hasOwnProperty.call(current, brawlerId)) return current;
        return Object.fromEntries(Object.entries(current).filter(([id]) => id !== brawlerId));
      }
      return { ...current, [brawlerId]: tier };
    });
  }, []);

  const addMatchup = useCallback((matchup: Matchup) => {
    if (
      BRAWLERS.find((brawler) => brawler.id === matchup.attacker)?.available === false ||
      BRAWLERS.find((brawler) => brawler.id === matchup.defender)?.available === false
    )
      return;
    const identity = matchupIdentity(matchup);
    setCustom((current) => [
      matchup,
      ...current.filter((entry) => matchupIdentity(entry) !== identity),
    ]);
  }, []);

  const importCustomRules = useCallback((backup: CustomRulesBackup) => {
    const importedIdentities = new Set(backup.matchups.map(matchupIdentity));
    setCustom((current) => [
      ...backup.matchups,
      ...current.filter((matchup) => !importedIdentities.has(matchupIdentity(matchup))),
    ]);
    setDeletedGuideMatchups((current) => [
      ...new Set([...current, ...backup.deletedGuideMatchups]),
    ]);
    setCustomMapBrawlers((current) => ({ ...current, ...backup.mapBrawlers }));
    setCustomModeBrawlers((current) => ({ ...current, ...backup.modeBrawlers }));
    setCustomBrawlerTiers((current) => ({ ...current, ...backup.brawlerTiers }));
    setCustomMapBrawlerTiers((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(backup.mapBrawlerTiers).map(([mapId, tiers]) => [
          mapId,
          { ...current[mapId], ...tiers },
        ]),
      ),
    }));
  }, []);

  const deleteMatchup = useCallback((matchup: Matchup, fromGuide = false) => {
    const identities = new Set([matchupIdentity(matchup)]);
    if (!matchup.asymmetric) {
      identities.add(
        matchupIdentity({
          ...matchup,
          attacker: matchup.defender,
          defender: matchup.attacker,
        }),
      );
    }
    setCustom((current) => current.filter((entry) => !identities.has(matchupIdentity(entry))));
    if (fromGuide) {
      const keys = [guideMatchupKey(matchup.attacker, matchup.defender)];
      if (!matchup.asymmetric) keys.push(guideMatchupKey(matchup.defender, matchup.attacker));
      setDeletedGuideMatchups((current) => [...new Set([...current, ...keys])]);
    }
  }, []);
  const restoreGuideMatchups = useCallback(() => {
    setCustom((current) => current.filter((matchup) => !isGuideMatchupOverride(matchup)));
    setDeletedGuideMatchups([]);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      bannedBrawlers,
      disabledMapIds,
      custom,
      deletedGuideMatchups,
      mapBrawlerOverrides: customMapBrawlers,
      mapBrawlerTierOverrides: customMapBrawlerTiers,
      modeBrawlerOverrides: customModeBrawlers,
      brawlerTierOverrides: customBrawlerTiers,
      ds: buildDataset(
        custom,
        customBrawlerNotes,
        deletedGuideMatchups,
        customMapBrawlers,
        customBrawlerTiers,
        customMapBrawlerTiers,
        customModeBrawlers,
      ),
      updateBrawlerNotes,
      setMapGoodBrawlers,
      toggleMapRotation,
      setMapBrawlerTier,
      resetMapGoodBrawlers,
      setModeGoodBrawlers,
      resetModeGoodBrawlers,
      setBrawlerTier,
      setMode: (mode) =>
        setDraft((d) => ({
          ...d,
          mode,
          mapId: d.mapId && MAPS.find((m) => m.id === d.mapId)?.mode === mode ? d.mapId : null,
        })),
      setMap: (mapId) => {
        if (mapId && disabledMapIds.includes(mapId)) return;
        setDraft((d) => ({
          ...d,
          mapId,
          mode: MAPS.find((m) => m.id === mapId)?.mode ?? d.mode,
        }));
      },
      setSlot,
      undoPick: () => setDraft((d) => undoLastPick(d)),
      toggleBan,
      beginFlow: () => setDraft((d) => beginDraftFlow(d)),
      continueToCoin: () => setDraft((d) => advanceToCoinSelection(d)),
      backToMap: () => setDraft((d) => ({ ...d, stage: "map" })),
      reset: () => {
        setDraft(EMPTY_DRAFT);
        setBannedBrawlers([]);
      },
      startDraft: (coin) => {
        setDraft((d) => beginPicks(d, coin));
      },
      addCustom: addMatchup,
      importCustomRules,
      removeCustom: (i) => setCustom((c) => c.filter((_, k) => k !== i)),
      deleteMatchup,
      restoreGuideMatchups,
    }),
    [
      draft,
      bannedBrawlers,
      disabledMapIds,
      custom,
      customBrawlerNotes,
      customMapBrawlers,
      customMapBrawlerTiers,
      customModeBrawlers,
      customBrawlerTiers,
      deletedGuideMatchups,
      updateBrawlerNotes,
      setMapGoodBrawlers,
      toggleMapRotation,
      setMapBrawlerTier,
      resetMapGoodBrawlers,
      setModeGoodBrawlers,
      resetModeGoodBrawlers,
      setBrawlerTier,
      addMatchup,
      importCustomRules,
      deleteMatchup,
      restoreGuideMatchups,
      setSlot,
      toggleBan,
    ],
  );

  return <DraftCtx.Provider value={value}>{children}</DraftCtx.Provider>;
}

export function useDraft() {
  const c = useContext(DraftCtx);
  if (!c) throw new Error("useDraft must be used inside DraftProvider");
  return c;
}
