import type { GameMap, Mode } from "@/lib/draft/types";

/** Modos e mapas da rotação de Ranqueado informada pelo usuário. */
export const MODES: Mode[] = [
  {
    id: "gem_grab",
    name: "Pique-Gema",
    imageUrl: "https://brawlify.com/images/game-modes/48000000.png",
    objectiveRoles: ["Controle", "Suporte", "Tanque"],
  },
  {
    id: "heist",
    name: "Roubo",
    imageUrl: "https://brawlify.com/images/game-modes/48000002.png",
    objectiveRoles: ["Dano", "Tanque", "Artilharia"],
  },
  {
    id: "bounty",
    name: "Caça-Estrelas",
    imageUrl: "https://brawlify.com/images/game-modes/48000003.png",
    objectiveRoles: ["Atirador", "Suporte"],
  },
  {
    id: "brawl_ball",
    name: "Fute-Brawl",
    imageUrl: "https://brawlify.com/images/game-modes/48000005.png",
    objectiveRoles: ["Tanque", "Assassino", "Controle"],
  },
  {
    id: "hot_zone",
    name: "Zona Estratégica",
    imageUrl: "https://brawlify.com/images/game-modes/48000017.png",
    objectiveRoles: ["Controle", "Tanque", "Artilharia"],
  },
  {
    id: "knockout",
    name: "Nocaute",
    imageUrl: "https://brawlify.com/images/game-modes/48000020.png",
    objectiveRoles: ["Atirador", "Controle", "Suporte"],
  },
];

/**
 * Terreno é uma estimativa inicial para apoiar recomendações gerais; não representa
 * estatísticas oficiais de desempenho. As imagens são carregadas pelo componente MapImage
 * a partir dos links de imagem do BrawlZone Ranked, servidos pelo CDN do Brawlify.
 */
const map = (
  id: string,
  name: string,
  mode: GameMap["mode"],
  walls: GameMap["walls"],
  bushes: GameMap["bushes"],
  openness: GameMap["openness"],
  traits: string[],
): GameMap => ({
  id,
  name,
  mode,
  walls,
  bushes,
  openness,
  traits,
  goodBrawlers: [],
  status: "estimativa",
});

export const MAPS: GameMap[] = [
  // Pique-Gema — Gem Grab
  map("double_swoosh", "Double Swoosh", "gem_grab", 2, 3, 1, [
    "Arbustos laterais",
    "Disputa pelo controle central",
  ]),
  map("gem_fort", "Gem Fort", "gem_grab", 3, 2, 1, ["Centro com obstáculos", "Rotas laterais"]),
  map("hard_rock_mine", "Hard Rock Mine", "gem_grab", 2, 3, 1, [
    "Centro fechado",
    "Arbustos nas laterais",
  ]),
  map("undermine", "Undermine", "gem_grab", 2, 3, 1, [
    "Área central disputada",
    "Arbustos e paredes",
  ]),
  map("crystal_arcade", "Crystal Arcade", "gem_grab", 2, 2, 2, ["Corredores com cobertura", "Disputa pelo controle central"]),
  // Roubo — Heist
  map("bridge_too_far", "Bridge Too Far", "heist", 1, 1, 3, [
    "Linhas de visão longas",
    "Rotas abertas ao cofre",
  ]),
  map("hot_potato", "Hot Potato", "heist", 2, 2, 2, [
    "Paredes próximas ao centro",
    "Rotas de avanço",
  ]),
  map("kaboom_canyon", "Kaboom Canyon", "heist", 2, 1, 3, [
    "Linhas de tiro longas",
    "Cobertura central",
  ]),
  map("safe_zone", "Safe Zone", "heist", 2, 1, 3, ["Rotas laterais para o cofre", "Áreas abertas"]),
  // Caça-Estrelas — Bounty
  map("dry_season", "Dry Season", "bounty", 2, 1, 3, [
    "Linhas de visão longas",
    "Cobertura pontual",
  ]),
  map("hideout", "Hideout", "bounty", 2, 2, 2, [
    "Cobertura central",
    "Arbustos nas rotas laterais",
  ]),
  map("layer_cake", "Layer Cake", "bounty", 2, 2, 2, [
    "Corredores e cobertura",
    "Disputa pelo centro",
  ]),
  map("shooting_star", "Shooting Star", "bounty", 1, 2, 3, [
    "Mapa aberto",
    "Linhas de visão longas",
  ]),
  // Fute-Brawl — Brawl Ball
  map("center_stage", "Center Stage", "brawl_ball", 2, 2, 2, [
    "Centro disputado",
    "Cobertura nas laterais",
  ]),
  map("pinball_dreams", "Pinball Dreams", "brawl_ball", 2, 1, 2, [
    "Paredes que alteram as rotas",
    "Corredores de avanço",
  ]),
  map("sneaky_fields", "Sneaky Fields", "brawl_ball", 2, 3, 1, [
    "Muitos arbustos",
    "Aproximação protegida",
  ]),
  map("triple_dribble", "Triple Dribble", "brawl_ball", 2, 2, 2, [
    "Corredores de ataque",
    "Paredes perto do gol",
  ]),
  map("beach_ball", "Beach Ball", "brawl_ball", 2, 2, 2, ["Rotas laterais", "Cobertura distribuída"]),
  // Zona Estratégica — Hot Zone
  map("dueling_beetles", "Dueling Beetles", "hot_zone", 3, 1, 1, [
    "Muitas paredes",
    "Controle de zona",
  ]),
  map("open_business", "Open Business", "hot_zone", 2, 1, 3, [
    "Áreas abertas",
    "Controle de espaço",
  ]),
  map("parallel_plays", "Parallel Plays", "hot_zone", 2, 2, 2, [
    "Rotas paralelas",
    "Disputa por zonas",
  ]),
  map("ring_of_fire", "Ring of Fire", "hot_zone", 2, 2, 2, [
    "Zona central",
    "Cobertura ao redor do objetivo",
  ]),
  // Nocaute — Knockout
  map("belles_rock", "Belle's Rock", "knockout", 2, 1, 3, [
    "Linhas de visão longas",
    "Cobertura pontual",
  ]),
  map("flaring_phoenix", "Flaring Phoenix", "knockout", 2, 1, 3, [
    "Disputas à distância",
    "Cobertura limitada",
  ]),
  map("flowing_springs", "Flowing Springs", "knockout", 2, 2, 2, [
    "Cobertura distribuída",
    "Rotas de avanço",
  ]),
  map("goldarm_gulch", "Goldarm Gulch", "knockout", 2, 2, 2, [
    "Cobertura central",
    "Rotas laterais",
  ]),
  map("new_horizons", "New Horizons", "knockout", 1, 1, 3, [
    "Mapa aberto",
    "Linhas de tiro longas",
  ]),
  map("out_in_the_open", "Out in the Open", "knockout", 1, 1, 3, [
    "Pouca cobertura",
    "Longo alcance favorecido",
  ]),
];
