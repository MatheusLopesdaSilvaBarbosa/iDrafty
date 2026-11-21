// Domain types for IDrafty. Data files must conform to these; the engine only reads them.

export type Role =
  "Dano" | "Tanque" | "Atirador" | "Assassino" | "Suporte" | "Controle" | "Artilharia";

export type Level = 1 | 2 | 3; // baixo / médio / alto
export type RangeClass = "curto" | "medio" | "longo";

export type BrawlerRarity =
  | "Inicial"
  | "Raro"
  | "Super-raro"
  | "Épico"
  | "Mítico"
  | "Lendário"
  | "Ultralendário"
  | "Indisponível";

/** Provenance of a piece of data (section 11 of the brief). */
export type DataStatus =
  "confirmado" | "fonte_externa" | "avaliacao_manual" | "estimativa" | "nao_verificado";

export type Confidence = "baixa" | "media" | "alta";
export type StrategicTier = "meta" | "subMeta" | "none";

export type ModeId = "gem_grab" | "brawl_ball" | "heist" | "hot_zone" | "knockout" | "bounty";

export interface Mode {
  id: ModeId;
  name: string;
  /** Optional mode artwork URL. */
  imageUrl?: string;
  /** Roles that typically help with the mode objective (manual evaluation). */
  objectiveRoles: Role[];
  /** Optional user-defined recommendations; undefined means use the strategy guide. */
  recommendedBrawlers?: string[];
}

export interface GameMap {
  id: string;
  name: string;
  mode: ModeId;
  walls: Level;
  bushes: Level;
  openness: Level; // 3 = long sight lines
  traits: string[];
  /** Optional map artwork URL from the public BrawlAPI catalog. */
  imageUrl?: string;
  /** Brawlers believed to perform well here. Empty when no reliable data. */
  goodBrawlers: string[];
  /** Effective per-map ratings after guide defaults and local edits are applied. */
  brawlerTiers?: Record<string, "neutral" | "best" | "worst">;
  status: DataStatus;
}

export interface Brawler {
  id: string;
  name: string;
  meta?: boolean;
  subMeta?: boolean;
  /** Canonical name used to resolve external portrait assets. */
  imageAlias?: string;
  /** Official/game rarity category, or unavailable when the character is not in the current pool. */
  rarity: BrawlerRarity;
  /** False for characters unavailable in the current ranked pool. */
  available?: boolean;
  role: Role;
  range: RangeClass;
  mobility: Level;
  durability: Level;
  damage: Level;
  areaControl: Level;
  crowdControl: Level;
  pressure: Level;
  /** Tags describing what this brawler struggles against, e.g. "burst_curto", "alcance_longo". */
  weakTo: string[];
  /** Tags this brawler provides, used to match against others' weaknesses. */
  provides: string[];
  dependsOn: ("paredes" | "arbustos" | "espaco_aberto")[];
  strengths: string[];
  weaknesses: string[];
  goodModes: ModeId[];
  notes?: string;
  status: DataStatus;
  updated: string; // version / date
}

export interface Matchup {
  attacker: string;
  defender: string;
  /** -5..+5 ordinal, advantage of attacker vs defender. NOT a win probability. */
  score: number;
  mapId?: string | undefined;
  mode?: ModeId | undefined;
  explanation: string;
  source: string;
  confidence: Confidence;
  status: DataStatus;
  reviewed: string;
  /** When true the inverse is not auto-generated. */
  asymmetric?: boolean;
}

export interface Synergy {
  a: string;
  b: string;
  score: number; // -5..+5
  explanation: string;
  confidence: Confidence;
  status: DataStatus;
}

export interface Dataset {
  brawlers: Brawler[];
  matchups: Matchup[];
  disabledGuideMatchups?: string[];
  synergies: Synergy[];
  maps: GameMap[];
  modes: Mode[];
}

export const guideMatchupKey = (attacker: string, defender: string) => `${attacker}->${defender}`;

export type DraftCoin = "blue" | "red";
export type DraftStage = "start" | "map" | "coin" | "picks";

export interface DraftState {
  /** Coin selected to determine the pick order. */
  coin?: DraftCoin | null;
  /** Picks remain locked until the user explicitly starts the draft. */
  started?: boolean;
  /** Current step in the setup and pick flow. */
  stage?: DraftStage;
  mode: ModeId | null;
  mapId: string | null;
  allies: (string | null)[];
  enemies: (string | null)[];
}
