import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Brawler, Mode, BrawlerRarity, Role, RangeClass, DataStatus } from "@/lib/draft/types";
import { BRAWLERS } from "@/data/brawlers";
import { MODES } from "@/data/maps";

export type Locale = "en" | "pt-BR";
const STORAGE_KEY = "idrafty-locale";
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void } | null>(
  null,
);

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "pt-BR") return saved;
  return navigator.language.toLowerCase() === "pt-br" ? "pt-BR" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
    const english: Record<string, string> = { ...messages.en };
    for (const brawler of BRAWLERS) {
      if (brawler.imageAlias && brawler.name !== brawler.imageAlias)
        english[brawler.name] = brawler.imageAlias;
    }
    for (const mode of MODES) english[mode.name] = MODE_NAMES[mode.id];
    const portugueseByEnglish = new Map<string, string>(
      Object.entries(english).map(([pt, en]) => [en, pt] as const),
    );
    const activeDictionary = locale === "en" ? english : Object.fromEntries(portugueseByEnglish);
    const phrases = Object.keys(activeDictionary)
      .filter((key) => key.length >= 8 && key.includes(" "))
      .sort((a, b) => b.length - a.length);
    const properNames = [
      ...BRAWLERS.filter((brawler) => brawler.name !== brawler.imageAlias).map((brawler) =>
        locale === "en"
          ? ([brawler.name, brawler.imageAlias ?? brawler.name] as const)
          : ([brawler.imageAlias ?? brawler.name, brawler.name] as const),
      ),
      ...MODES.map((mode) =>
        locale === "en"
          ? ([mode.name, MODE_NAMES[mode.id]] as const)
          : ([MODE_NAMES[mode.id], mode.name] as const),
      ),
    ].sort((a, b) => b[0].length - a[0].length);
    const lookup = (raw: string) => {
      const value = raw.trim().replace(/\s+/g, " ");
      if (!value) return undefined;
      const exact = activeDictionary[value];
      // Avoid writing identical text back into an observed node. That would
      // trigger the MutationObserver indefinitely for unchanged labels.
      if (exact && exact !== value) return exact;
      let result = raw;
      for (const key of phrases) {
        if (result.includes(key)) result = result.replaceAll(key, activeDictionary[key] ?? key);
      }
      for (const [source, target] of properNames) {
        if (locale === "pt-BR" && result.includes(target)) continue;
        const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        result = result.replace(
          new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "giu"),
          (_match, prefix: string) => `${prefix}${target}`,
        );
      }
      return result === raw ? undefined : result;
    };
    const translateTree = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const raw = node.nodeValue ?? "";
        if (!raw.trim()) continue;
        const translated = lookup(raw);
        if (translated)
          node.nodeValue = `${raw.match(/^\s*/)?.[0] ?? ""}${translated}${raw.match(/\s*$/)?.[0] ?? ""}`;
      }
      if (root instanceof HTMLElement) {
        for (const attribute of ["placeholder", "title", "aria-label"]) {
          const raw = root.getAttribute(attribute) ?? "";
          if (!raw.trim()) continue;
          const translated = lookup(raw);
          if (translated) root.setAttribute(attribute, translated);
        }
      }
    };
    translateTree(document.body);
    translateTree(document.head);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") {
          const raw = record.target.nodeValue ?? "";
          if (!raw.trim()) continue;
          const translated = lookup(raw);
          if (translated)
            record.target.nodeValue = `${raw.match(/^\s*/)?.[0] ?? ""}${translated}${raw.match(/\s*$/)?.[0] ?? ""}`;
        } else record.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      attributes: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside I18nProvider");
  return context;
}

const MODE_NAMES: Record<Mode["id"], string> = {
  gem_grab: "Gem Grab",
  heist: "Heist",
  bounty: "Bounty",
  brawl_ball: "Brawl Ball",
  hot_zone: "Hot Zone",
  knockout: "Knockout",
};

export function displayBrawlerName(brawler: Pick<Brawler, "name" | "imageAlias">, locale: Locale) {
  return locale === "en" ? brawler.imageAlias || brawler.name : brawler.name;
}

export function displayModeName(mode: Pick<Mode, "id" | "name">, locale: Locale) {
  return locale === "en" ? MODE_NAMES[mode.id] : mode.name;
}

export function displayRarity(rarity: BrawlerRarity, locale: Locale) {
  return t(rarity, locale);
}

export function displayRole(role: Role, locale: Locale) {
  return t(role, locale);
}

export function displayRange(range: RangeClass, locale: Locale) {
  return t(range, locale);
}

export function displayDataStatus(status: DataStatus, locale: Locale) {
  const labels: Record<DataStatus, string> = {
    confirmado: "Confirmado",
    fonte_externa: "Fonte externa",
    avaliacao_manual: "Avaliação manual",
    estimativa: "Estimativa",
    nao_verificado: "Não verificado",
  };
  return t(labels[status], locale);
}

const extraEn: Record<string, string> = {
  "Tier estratégico": "Strategic tier",
  "É counterado por:": "Countered by:",
  "É hard counter de:": "Hard counters:",
  "Mapas desfavoráveis:": "Unfavorable maps:",
  "Já escolhido": "Already picked",
  "Cobertura de matchups: selecione adversários": "Matchup coverage: select opponents",
  "Hard counters ainda disponíveis:": "Hard counters still available:",
  "Nenhum — já foram escolhidos ou banidos.": "None — they have already been picked or banned.",
  "Os mapas disponíveis para o modo escolhido aparecem abaixo.":
    "Maps available for the selected mode are shown below.",
  "Escolha um modo para ver os mapas disponíveis.": "Choose a mode to see the available maps.",
  "Todos os mapas deste modo estão desativados na rotação.":
    "All maps for this mode are currently out of rotation.",
  "Link da imagem indisponível": "Image link unavailable",
  "Matchup estratégico": "Strategic matchup",
  "Avaliação manual": "Manual rating",
  "Não verificado": "Unverified",
  "Nota estratégica (não é probabilidade de vitória)": "Strategic rating (not a win probability)",
  "Beta: o iDrafty está em desenvolvimento. Matchups, sinergias e atributos podem conter imprecisões e não são estatísticas oficiais. Notas são graus estratégicos, não chances de vitória.":
    "Beta: iDrafty is in development. Matchups, synergies, and attributes may be inaccurate and are not official statistics. Ratings are strategic scores, not win probabilities.",
  "Picks registrados": "Picks recorded",
  "Equipe Adversária escolhe agora": "The opposing team picks now",
  "Azul: Sua Equipe → Adversária → Adversária → Sua Equipe → Sua Equipe → Adversária":
    "Blue: Your team → Opponent → Opponent → Your team → Your team → Opponent",
  "Vermelha: Adversária → Sua Equipe → Sua Equipe → Adversária → Adversária → Sua Equipe":
    "Red: Opponent → Your team → Your team → Opponent → Opponent → Your team",
  Adversária: "Opponent",
  "Ver análise de last pick": "View last pick analysis",
  "Próximo pick recomendado": "Recommended next pick",
  "Voltar às três primeiras sugestões para o adversário":
    "Back to the opponent's top three suggestions",
  "Voltar às três primeiras sugestões": "Back to the top three suggestions",
  "Ver sugestões para o adversário até a quinta posição":
    "View opponent suggestions through rank five",
  "Ver até a quinta sugestão": "View through the fifth suggestion",
  "Draft concluído · Nota da composição": "Draft complete · Team rating",
  "Nota estratégica da sua equipe; não representa chance de vitória.":
    "Your team's strategic rating; this is not a win probability.",
  "Não foi possível calcular a nota da composição.": "Could not calculate the team rating.",
  "Composição — IDrafty": "Composition — iDrafty",
  "Análise de sinergia, cobertura e vulnerabilidades da sua equipe.":
    "Analyze your team's synergy, coverage, and vulnerabilities.",
  Composição: "Composition",
  "Monte sua equipe": "Build your team",
  "Preencha seus picks na página Draft. Quando houver aliados registrados, o tour segue para a análise.":
    "Add your picks on the Draft page. Once your team has picks, the tutorial will continue to the analysis.",
  "Revise as notas individuais": "Review individual ratings",
  "Abra uma nota para ver os matchups e fatores considerados para cada brawler.":
    "Open a rating to see each Brawler's matchups and contributing factors.",
  "Compare as equipes": "Compare the teams",
  "Confira o panorama das duas composições. A pontuação é uma estimativa estratégica, não chance de vitória.":
    "Review both team compositions. The score is a strategic estimate, not a win probability.",
  "Cada nota considera o brawler contra a composição adversária, além do modo, mapa e sinergia com seus próprios aliados.":
    "Each rating considers the Brawler against the opposing team, as well as the mode, map, and synergy with your teammates.",
  "Notas estratégicas de 0 a 100; não representam chance de vitória.":
    "Strategic ratings from 0 to 100; they do not represent win probability.",
  "Comparativo das composições": "Team comparison",
  "Azul é sempre sua equipe; vermelho é a equipe adversária. Notas estratégicas, não chances de vitória.":
    "Blue always represents your team; red represents the opponent. These are strategic ratings, not win probabilities.",
  "Ranking dos melhores last picks contra os três adversários, com justificativas.":
    "Ranked best last picks against the three opponents, with explanations.",
  Média: "Medium",
  "Preencha os picks inimigos na página Draft. O ranking usa esses confrontos para avaliar candidatos.":
    "Add the enemy picks on the Draft page. The ranking uses these matchups to evaluate candidates.",
  "Leia os riscos e counters ainda disponíveis. Selecionar um brawler atualiza seu próximo pick no Draft.":
    "Review the risks and available counters. Selecting a Brawler updates your next pick in Draft.",
  "As listas mostram matchups favoráveis e desfavoráveis com os dados disponíveis.":
    "The lists show favorable and unfavorable matchups based on available data.",
  "Quando modo e mapa estiverem definidos no Draft, registros específicos desse contexto têm prioridade.":
    "When a mode and map are set in Draft, matchup records for that context take priority.",
  "Confrontos sem registro não aparecem. Ausência de dados não significa vantagem nem desvantagem.":
    "Unrecorded matchups are hidden. Missing data does not mean an advantage or disadvantage.",
  "Brawlers sem registro são tratados como neutros (0) e não aparecem aqui.":
    "Brawlers without a matchup record are treated as neutral (0) and are not shown here.",
  "Puxão leva alvos para o burst de Shelly.": "Pulls targets into Shelly's burst damage.",
  "Cura à distância mantém Frank vivo.": "Ranged healing keeps Frank alive.",
  "Lentidão e atordoamento em sequência.": "Slow and stun in succession.",
  "Dois arremessadores frágeis compartilham a mesma fraqueza.":
    "Two fragile throwers share the same weakness.",
  "Dois mergulhadores sem controle de área.": "Two divers without area control.",
  "Pode contribuir para pressão ofensiva": "Can contribute offensive pressure",
  "Perfil estratégico precisa ser validado": "Strategic profile needs validation",
  "Pressão e resistência em curta distância": "Close-range pressure and durability",
  "Pressão à distância": "Ranged pressure",
  "Vulnerável a mergulhos": "Vulnerable to dives",
  "Ameaça alvos frágeis e cria pressão": "Threatens fragile targets and creates pressure",
  "Controla espaço e rotas": "Controls space and lanes",
  "Pode sofrer contra pressão rápida": "Can struggle against fast pressure",
  "Pressiona inimigos atrás de paredes": "Pressures enemies behind walls",
  "Vulnerável quando alcançado": "Vulnerable when reached",
  "Super destrói paredes": "Super destroys walls",
  "Vulnerável a kiting e controle": "Vulnerable to kiting and control",
  "Dano máximo à distância": "Maximum damage at range",
  "Marcação aumenta dano": "Marking increases damage",
  "Disparo difícil de acertar": "Shots are difficult to land",
  Previsível: "Predictable",
  "Atordoamento em área": "Area stun",
  "Fraca em espaço aberto": "Weak in open spaces",
  "Empurrão afasta assassinos": "Knockback repels assassins",
  "Cura em área": "Area healing",
  "Muito frágil": "Very fragile",
  "Puxa alvos prioritários": "Pulls priority targets",
  "Controle de área contínuo": "Sustained area control",
  "Grande controle de área": "Strong area control",
  "Lentidão com o Super": "Super slows enemies",
  "Controle de área atrás de paredes": "Area control behind walls",
  Frágil: "Fragile",
  "Nega espaço atrás de paredes": "Denies space behind walls",
  "Burst alto atrás de paredes": "High burst damage behind walls",
  "Sem alerta geral de last pick por arquétipo; ainda assim, confira o mapa, o modo e as respostas disponíveis no draft inimigo.":
    "No general last-pick warning for this archetype; still check the map, mode, and available answers in the enemy draft.",
  "ATENÇÃO: pode ser arriscado escolher cedo; o adversário ainda pode responder com counters adequados. Considere last pick se o mapa/draft não garantir condições favoráveis.":
    "WARNING: picking early can be risky; the opponent may still respond with effective counters. Consider saving this for last pick unless the map and draft provide favorable conditions.",
  "ATENÇÃO: pode sofrer contra controle e dano à distância; avalie o mapa e os picks restantes.":
    "WARNING: can struggle against control and ranged damage; consider the map and remaining picks.",
  "ATENÇÃO: lançador que depende de posicionamento; mergulhos rápidos e pressão de longo alcance podem puni-lo.":
    "WARNING: a thrower who relies on positioning; fast dives and long-range pressure can punish them.",
  "ATENÇÃO: pode sofrer contra pressão de longo alcance e inimigos que entrem rapidamente em sua zona.":
    "WARNING: can struggle against long-range pressure and enemies who quickly enter their zone.",
  "ATENÇÃO: tanques de curto alcance sofrem quando o inimigo tem dano antitanque, controle ou mapas abertos.":
    "WARNING: short-range tanks struggle against anti-tank damage, control, or open maps.",
  "ATENÇÃO: pode ser neutralizado por controle e ferramentas antitanque; avalie os counters antes de escolhê-lo cedo.":
    "WARNING: can be shut down by control and anti-tank tools; consider available counters before picking early.",
  "ATENÇÃO: apesar da resistência, pode ser neutralizado por controle e respostas específicas de dano.":
    "WARNING: despite being durable, can be shut down by control and specific damage options.",
  "ATENÇÃO: lançador com alto potencial, mas vulnerável a assassinos/mobilidade e pressão de longo alcance.":
    "WARNING: a high-potential thrower, but vulnerable to assassins, mobility, and long-range pressure.",
  "ALTO RISCO: considere last pick; depende muito de alvos frágeis e pode ser parado por controle, escudos, empurrões e dano explosivo.":
    "HIGH RISK: consider saving this for last pick; relies heavily on fragile targets and can be stopped by control, shields, knockback, and burst damage.",
  "ATENÇÃO: tanque de curto alcance; escolha com cuidado se o rival ainda pode selecionar controle, empurrões ou dano antitanque.":
    "WARNING: a short-range tank; pick carefully if the opponent can still choose control, knockback, or anti-tank damage.",
  "ATENÇÃO: grande alvo e vulnerável a controle/interrupções; escolha cedo apenas se mapa e draft forem favoráveis.":
    "WARNING: a large target vulnerable to control and interrupts; pick early only when the map and draft are favorable.",
  "ATENÇÃO: lançador que pode sofrer contra inimigos móveis e pressão de longo alcance.":
    "WARNING: a thrower who can struggle against mobile enemies and long-range pressure.",
  "ATENÇÃO: pode ser previsível e sofrer contra alcance, controle e pressão constante.":
    "WARNING: can be predictable and struggle against range, control, and constant pressure.",
  "ATENÇÃO: precisa chegar perto; alcance, lentidão e empurrões podem dificultar sua aproximação.":
    "WARNING: needs to get close; range, slows, and knockback can make it difficult to engage.",
  "ATENÇÃO: seu valor depende de posicionamento e terreno; confira as respostas do inimigo antes de escolher cedo.":
    "WARNING: value depends on positioning and terrain; check the enemy's answers before picking early.",
  "ATENÇÃO: lançador que pode ser punido por alcance, mobilidade ou respostas eficientes às unidades invocadas.":
    "WARNING: a thrower who can be punished by range, mobility, or effective answers to summoned units.",
  "ATENÇÃO: escolha mais segura quando o draft já revela alvos frágeis e poucas ferramentas de controle.":
    "WARNING: a safer pick when the draft reveals fragile targets and few control tools.",
  "ALTO RISCO: costuma precisar de um draft favorável; inimigos com controle, ataques fáceis de acertar ou boa defesa podem dificultar bastante suas entradas.":
    "HIGH RISK: usually needs a favorable draft; enemies with control, easy-to-land attacks, or strong defense can make engaging difficult.",
  "ALTO RISCO: geralmente é melhor como last pick; muitos picks com controle, dano em área, empurrão ou boa defesa podem neutralizá-lo.":
    "HIGH RISK: usually better as a last pick; multiple picks with control, area damage, knockback, or strong defense can shut it down.",
  "ATENÇÃO: escolha situacional; avalie o mapa, o modo e as respostas ainda disponíveis antes de fechar o pick.":
    "WARNING: a situational pick; consider the map, mode, and remaining enemy answers before locking it in.",
  "Guia tático ainda não validado.": "Tactical guide not yet verified.",
  "ATENÇÃO: depende de aproximação e pressão curta; alcance e controle podem limitar seu impacto.":
    "WARNING: relies on closing the gap and applying close-range pressure; range and control can limit its impact.",
  "ATENÇÃO: depende de paredes e controle de espaço; mapas abertos ou inimigos móveis podem reduzir seu valor.":
    "WARNING: relies on walls and space control; open maps or mobile enemies can reduce its value.",
  "ATENÇÃO: controle de área forte, mas pode sofrer contra inimigos que evitem seus projéteis e o pressionem.":
    "WARNING: strong area control, but can struggle against enemies who dodge its projectiles and pressure it.",
  "ATENÇÃO: forte para negar espaço, mas vulnerável quando inimigos conseguem alcançá-lo.":
    "WARNING: strong at denying space, but vulnerable when enemies can reach it.",
  "ATENÇÃO: lançadora vulnerável se for alcançada ou pressionada diretamente.":
    "WARNING: a thrower who is vulnerable when reached or directly pressured.",
  "Possível last pick: lançador vulnerável a mergulhos, mobilidade ou pressão de longo alcance. Confira o mapa e os picks inimigos.":
    "Possible last pick: a thrower vulnerable to dives, mobility, or long-range pressure. Check the map and enemy picks.",
  "Possível last pick: o adversário ainda pode responder com controle, empurrões, mobilidade ou dano antitanque. Avalie o draft antes de escolher cedo.":
    "Possible last pick: the opponent can still answer with control, knockback, mobility, or anti-tank damage. Assess the draft before picking early.",
  "O guia estratégico indica que este Brawler é counterado pelo adversário.":
    "The strategy guide indicates that this Brawler is countered by the opponent.",
  "O guia estratégico indica vantagem neste confronto.":
    "The strategy guide indicates an advantage in this matchup.",
  "adequação ao modo e mapa": "mode and map fit",
  "Nenhum adversário conhecido: recomendações baseadas só em mapa, modo e equipe.":
    "No known opponents: recommendations are based only on the map, mode, and team.",
  "Sem mapa selecionado: adequação ao terreno usa valor neutro.":
    "No map selected: terrain fit is treated as neutral.",
  "O guia não tem destaque para o melhor candidato neste mapa: adequação ao mapa tratada como neutra.":
    "The guide has no featured pick for this map: map fit is treated as neutral.",
  "O guia não tem modos de destaque para o melhor candidato: adequação ao modo tratada como neutra.":
    "The guide has no featured modes for this pick: mode fit is treated as neutral.",
  "Confiança baixa: a qualidade ou a cobertura dos dados é insuficiente para uma recomendação forte.":
    "Low confidence: data quality or coverage is insufficient for a strong recommendation.",
  "Pouco alcance ou mobilidade para enfrentar adversários de longa distância.":
    "Limited range or mobility against long-range opponents.",
  "Bom controle de área combinado.": "Good combined area control.",
  "Funções bem distribuídas.": "Well-balanced team roles.",
  "Matchups favoráveis contra a equipe adversária.":
    "Favorable matchups against the opposing team.",
  "Matchups desfavoráveis contra a equipe adversária no geral.":
    "Generally unfavorable matchups against the opposing team.",
  "Opção A — Priorizar matchup": "Option A — Prioritize matchups",
  "Maximiza vantagem contra os adversários conhecidos.":
    "Maximizes advantage against known opponents.",
  "Pode deixar a equipe com funções repetidas ou pouca sinergia.":
    "May leave the team with overlapping roles or low synergy.",
  "Opção B — Priorizar sinergia": "Option B — Prioritize synergy",
  "Pode ignorar counters dos adversários.": "May ignore opponent counters.",
  "Opção C — Segurança e flexibilidade": "Option C — Safety and flexibility",
  "Favorece cobertura de funções, encaixe no mapa e poucas fraquezas.":
    "Favors role coverage, map fit, and fewer weaknesses.",
  "Caça-Estrelas": "Bounty",
  "Zona Estratégica": "Hot Zone",
  "Centro com obstáculos": "Obstacle-filled center",
  "Área central disputada": "Contested central area",
  "Linhas de visão longas": "Long sightlines",
  "Paredes próximas ao centro": "Walls near the center",
  "Rotas de avanço": "Advance routes",
  "Áreas abertas": "Open areas",
  "Corredores de avanço": "Advance corridors",
  "Aproximação protegida": "Protected approach",
  "Controle de espaço": "Space control",
  "Cobertura distribuída": "Distributed cover",
  "O texto não contém um pacote de regras IDrafty.":
    "This text does not contain an iDrafty rules package.",
  "Formato ou versão do JSON não são compatíveis.": "The JSON format or version is not compatible.",
  "A data de exportação do JSON é inválida.": "The JSON export date is invalid.",
  "O texto está incompleto ou possui listas inválidas.":
    "The text is incomplete or contains invalid lists.",
  "Há regras inválidas: confira Brawlers, mapas, notas e justificativas.":
    "Some rules are invalid: check Brawlers, maps, ratings, and explanations.",
  "O JSON contém regras de matchup duplicadas.": "The JSON contains duplicate matchup rules.",
  "O texto contém exclusões inválidas ou duplicadas.":
    "The text contains invalid or duplicate exclusions.",
  "Há regras de mapas inválidas: confira os mapas e os brawlers selecionados.":
    "Some map rules are invalid: check the maps and selected Brawlers.",
  "Há regras de modos inválidas: confira os modos e os brawlers selecionados.":
    "Some mode rules are invalid: check the modes and selected Brawlers.",
  "Há classificações de brawlers inválidas.": "Some Brawler ratings are invalid.",
  "Há classificações de brawlers por mapa inválidas.":
    "Some map-specific Brawler ratings are invalid.",
  "Não foi possível gerar o JSON.": "Could not generate the JSON.",
  "JSON copiado para a área de transferência.": "JSON copied to clipboard.",
  "Não foi possível copiar o JSON.": "Could not copy the JSON.",
  "O texto não contém JSON válido.": "The text does not contain valid JSON.",
  "Não foi possível importar as regras.": "Could not import the rules.",
  Página: "Page",
  Próxima: "Next",
  "Recomendações do modo": "Mode recommendations",
  "Abra a edição do modo": "Open mode editor",
  "Conclua a edição": "Finish editing",
  "Classificações por mapa": "Map ratings",
  "Conclua a edição do mapa": "Finish editing the map",
  Personalizações: "Customizations",
  "Revise o conteúdo": "Review the contents",
  "Nenhuma recomendação personalizada para mapas ou modos.":
    "No custom map or mode recommendations.",
  "Matchups padrão": "Default matchups",
  "Restaurar alterações para o código": "Restore code defaults",
  "Nenhum matchup do guia disponível.": "No guide matchups available.",
  "Edições e exclusões da base afetam somente este navegador.":
    "Database edits and exclusions only affect this browser.",
  Rotação: "Rotation",
  "Nenhum brawler listado como desfavorável neste mapa.":
    "No Brawlers are listed as unfavorable on this map.",
  "Não perguntar novamente até atualizar o site": "Don't ask again until the site is updated",
  "A alteração será salva neste navegador e terá prioridade sobre a base original.":
    "This change will be saved in this browser and will take priority over the original data.",
  "Salvar alterações": "Save changes",
  "Inimigo NÃO JOGA": "Enemy CANNOT PLAY",
  Desfazer: "Undo",
  Excluir: "Delete",
  "Importar JSON": "Import JSON",
  "Exportar JSON": "Export JSON",
  "Restaurar original": "Restore original",
  Personalizado: "Custom",
  Modos: "Modes",
  Meta: "Meta",
  "Sub-META": "Sub-Meta",
  Geral: "General",
  "Buscar brawler...": "Search Brawlers...",
  "Escolher brawler": "Choose Brawler",
  Buscar: "Search",
  Fechar: "Close",
  Adicionar: "Add",
  Remover: "Remove",
  Concluir: "Done",
  "Escolher moeda azul": "Choose blue side",
  "Escolher moeda vermelha": "Choose red side",
  Épico: "Epic",
  Mítico: "Mythic",
  Lendário: "Legendary",
  Ultralendário: "Ultra Legendary",
  "Lightyear (indisponível)": "Lightyear (unavailable)",
  "Guia estratégico de 108 Brawlers": "Strategy guide for 108 Brawlers",
  "Consulte e atualize brawlers, modos, mapas e matchups da base estratégica.":
    "Browse and update Brawlers, modes, maps, and matchups in the strategy database.",
  "Selecione o brawler pelo retrato ou use a busca para encontrá-lo.":
    "Select a Brawler by portrait or use search to find one.",
  "Escolha Geral ou um modo para ver a opção do modo e os mapas disponíveis.":
    "Choose General or a mode to view its settings and available maps.",
  "Somente brawlers com alterações personalizadas. Você pode ajustar a classificação abaixo.":
    "Only Brawlers with custom changes are shown. You can adjust their ratings below.",
  "Marque os brawlers como META, Sub-META ou remova a classificação. As mudanças ficam salvas neste navegador e atualizam as recomendações do Draft.":
    "Mark Brawlers as META or Sub-META, or remove their rating. Changes are saved in this browser and update Draft recommendations.",
  "Consulte e personalize os dados usados nas recomendações. Suas alterações ficam salvas neste navegador.":
    "Review and customize the data used for recommendations. Your changes are saved in this browser.",
  "O Banco guarda os dados que alimentam as recomendações. Vamos ver registros reais e os controles que alteram matchups, tiers e recomendações por mapa e modo.":
    "The Database stores the data behind recommendations. Review real records and the controls for matchups, tiers, and map and mode recommendations.",
  "Abra esta seção para ver confrontos existentes no guia, suas notas, justificativas e status. Você também pode filtrar por brawler.":
    "Open this section to view guide matchups, their ratings, explanations, and status. You can also filter by Brawler.",
  "Cada linha representa uma regra de confronto usada nas recomendações. Use o lápis para editar brawlers, contexto, vantagem e justificativa.":
    "Each row is a matchup rule used for recommendations. Use the pencil to edit Brawlers, context, advantage, and explanation.",
  "Clique no lápis para abrir o formulário e alterar este matchup.":
    "Select the pencil to open the form and edit this matchup.",
  "Salve a alteração": "Save the change",
  "Clique em Salvar para gravar o matchup. O próximo passo aparece quando o salvamento terminar.":
    "Select Save to store the matchup. The next step appears when saving is complete.",
  "Clique para restaurar os registros padrão do guia. Uma janela central pedirá confirmação.":
    "Restore the guide's default records. A dialog will ask you to confirm.",
  "Confirme a restauração": "Confirm the restore",
  "Confira a confirmação e clique em Restaurar para recuperar os dados originais dos matchups.":
    "Review the confirmation and select Restore to recover the original matchup data.",
  "Os brawlers listados mostram as classificações atuais. Os botões META e Sub-META alternam cada tier e a busca localiza um brawler.":
    "The listed Brawlers show their current ratings. META and Sub-META buttons toggle each tier, and search finds a Brawler.",
  "Clique em META ou Sub-META para aplicar a classificação; clique novamente no tier ativo para removê-lo. As mudanças afetam o ranking do Draft e ficam salvas localmente.":
    "Select META or Sub-META to apply a rating. Select the active tier again to remove it. Changes affect the Draft ranking and are saved locally.",
  "Selecione um modo para ver mapas e brawlers recomendados. As recomendações podem ser personalizadas para o modo ou para cada mapa.":
    "Select a mode to view recommended maps and Brawlers. Recommendations can be customized for a mode or for each map.",
  "A lista mostra os brawlers cadastrados como melhores para o modo. Use Editar para alterar a seleção ou Restaurar original para recuperar os dados do guia.":
    "This list shows the Brawlers recommended for the mode. Select Edit to change the list or Restore original to recover the guide data.",
  "Use Editar para conferir quais brawlers estão recomendados para este modo.":
    "Select Edit to review which Brawlers are recommended for this mode.",
  "Clique nos brawlers para adicioná-los ou removê-los da lista. A alteração fica salva neste navegador.":
    "Select Brawlers to add them to or remove them from the list. Changes are saved in this browser.",
  "Clique em Concluir para sair do modo de edição. Depois, o tour aponta para a opção de restaurar a lista original.":
    "Select Done to leave edit mode. The tutorial will then point to the option for restoring the original list.",
  "Restaurar original remove as mudanças feitas na lista deste modo e recupera os brawlers recomendados pelo guia.":
    "Restore original removes your changes to this mode's list and restores the Brawlers recommended by the guide.",
  "Clique em Editar para abrir a lista de classificações por brawler.":
    "Select Edit to open the Brawler ratings list.",
  "Clique em um brawler para alternar entre neutro, melhor e pior. A alteração fica salva imediatamente.":
    "Select a Brawler to cycle between neutral, best, and worst. Changes are saved immediately.",
  "Clique em Concluir para sair da edição antes de fechar os detalhes.":
    "Select Done to exit edit mode before closing the details.",
  "Abra Personalizado para acessar as regras e alterações guardadas no navegador.":
    "Open Custom to access rules and changes saved in this browser.",
  "As abas dividem suas regras entre Matchups, Meta e Mapas e modos. Primeiro confira essas categorias; em seguida, abra Mapas e modos para encontrar a restauração.":
    "The tabs group your rules into Matchups, Meta, and Maps and modes. Review these categories, then open Maps and modes to find the restore option.",
  "Selecione Mapas e modos para ver as alterações dos brawlers por mapa.":
    "Select Maps and modes to view your map-specific Brawler changes.",
  "Reverter original remove as alterações deste mapa e recupera as recomendações do guia. Cada mapa pode ser restaurado separadamente.":
    "Restore original removes this map's changes and recovers the guide recommendations. Each map can be restored separately.",
  "Exportar JSON gera um texto de backup com suas regras de matchup e alterações personalizadas de tiers, modos e mapas. Clique para abrir o conteúdo exportado.":
    "Export JSON creates a text backup of your matchup rules and custom tier, mode, and map changes. Select it to view the exported content.",
  "A janela mostra o JSON completo do backup. Esse texto representa suas personalizações e pode ser armazenado como arquivo para importar depois.":
    "This dialog shows the full backup JSON. It contains your customizations and can be saved as a file for later import.",
  "Copie o texto para um arquivo ou serviço de armazenamento. Use Importar JSON em outro navegador para recuperar as personalizações; exportar não publica nada automaticamente.":
    "Copy the text to a file or storage service. Use Import JSON in another browser to restore your customizations; exporting does not publish anything.",
  "Regras que você adicionou, exibidas separadamente das matchups padrão do app.":
    "Rules you added, shown separately from the app's default matchups.",
  "Selecione um modo para ver os mapas da rotação e os melhores brawlers recomendados.":
    "Select a mode to view its map rotation and recommended Brawlers.",
  "Recomendações do guia estratégico; suas alterações ficam salvas neste navegador.":
    "Strategy guide recommendations; your changes are saved in this browser.",
  "Clique em cada brawler para alternar entre neutro, melhor e pior. As alterações ficam salvas neste navegador.":
    "Select each Brawler to cycle between neutral, best, and worst. Changes are saved in this browser.",
  "Brawlers recomendados para este mapa, com base nas sugestões do guia e nas suas alterações.":
    "Brawlers recommended for this map based on the guide and your changes.",
  "Restaurar alterações do Strategy Guide?": "Restore Strategy Guide changes?",
  "As edições e exclusões de matchups do guia neste navegador serão removidas. Os dados voltarão a refletir o código-fonte.":
    "Guide matchup edits and exclusions in this browser will be removed. Data will return to the source defaults.",
  "Este matchup será removido das recomendações deste navegador.":
    "This matchup will be removed from recommendations in this browser.",
  "Matchups padrão (": "Default matchups (",
  "Toque em Começar para configurar a partida.": "Select Start to set up the match.",
  "Selecione o modo e o mapa. As recomendações levam esse contexto em conta.":
    "Select a mode and map. Recommendations take this context into account.",
  "Sugestões de ban": "Ban suggestions",
  "Estas opções vêm dos destaques do guia estratégico para o mapa escolhido. Banir é opcional; use-as para retirar ameaças fortes antes dos picks. A tela avança sozinha após alguns segundos.":
    "These suggestions come from the strategy guide's highlights for the selected map. Banning is optional; use them to remove major threats before picks. This screen advances automatically after a few seconds.",
  "Entenda as sugestões": "Understand the suggestions",
  "A lista é recalculada a cada turno. O ranking considera o modo e o mapa, confrontos contra os brawlers já escolhidos, sinergia e cobertura da equipe. Avisos e justificativas do card ajudam a entender vantagens, riscos e dados com menor confiança.":
    "The list is recalculated after every turn. Rankings consider the mode and map, matchups against picked Brawlers, synergy, and team coverage. Card warnings and explanations help clarify advantages, risks, and lower-confidence data.",
  "Escolha uma sugestão": "Choose a suggestion",
  "Use o botão do card para escolher um brawler ou monte o draft livremente pelos espaços da equipe. O tour não escolhe por você.":
    "Use the card button to pick a Brawler, or build the draft freely through the team slots. The tutorial will not pick for you.",
  "Possíveis próximos picks do adversário": "Possible next picks for the opponent",
  "O adversário recebe sugestões pelo mesmo cálculo usado para a sua equipe: considera modo e mapa, matchups, sinergia e cobertura, agora avaliando os brawlers para o lado adversário. Você continua livre para escolher qualquer brawler e finalizar o draft.":
    "The opponent's suggestions use the same calculation as your team's: mode and map, matchups, synergy, and coverage, evaluated for their side. You can still choose any Brawler and complete the draft as you like.",
  "Continue escolhendo brawlers para as duas equipes. Quando for a vez do adversário, as sugestões usam o mesmo cálculo do seu time. Você pode ignorar as sugestões e finalizar como preferir.":
    "Keep picking Brawlers for both teams. When it is the opponent's turn, suggestions use the same calculation as for your team. You can ignore suggestions and finish the draft however you like.",
  "Com o draft concluído, esta ação abre a análise dedicada ao pick final, considerando as equipes e o contexto da partida.":
    "Once the draft is complete, this opens a dedicated last-pick analysis based on both teams and the match context.",
  "Abra a análise da composição para consultar a nota estratégica e os detalhes que explicam os pontos fortes e as lacunas do seu time.":
    "Open the team composition analysis to review its strategic rating and the strengths and gaps behind it.",
  "Planeje seu draft de Brawl Stars, compare matchups e monte sua composição com mais contexto.":
    "Plan your Brawl Stars draft, compare matchups, and build your team with more context.",
  "Identifique as vantagens e as desvantagens da sua composição e commpare com a do adversário.":
    "Identify your team's strengths and weaknesses, then compare them with the opponent's.",
  "Pare de ganhar somente por habilidade. Está na hora de ganhar por escolher certo. Escolha com iDraft.":
    "Stop relying on skill alone. It's time to win by making the right picks. Pick smart with iDrafty.",
};

const extraUi: Record<string, string> = {
  "Nenhum brawler encontrado.": "No Brawlers found.",
  "1. Escolha o modo": "1. Choose a mode",
  "2. Escolha o mapa": "2. Choose a map",
  "Clique para ampliar": "Click to enlarge",
  "Imagem ampliada do mapa": "Enlarged map image",
  "Super abre o mapa": "Super opens up the map",
  "Bom no modo de jogo": "Good in this game mode",
  "Modo de destaque": "Featured mode",
  "Sem modo selecionado.": "No mode selected.",
  "Vantagens menores; raramente a escolha mais forte.":
    "Minor advantages; rarely the strongest pick.",
  "Escolher posição": "Choose slot",
  Posição: "Slot",
  posição: "slot",
  Aliado: "Teammate",
  Adversário: "Opponent",
  "Banco de dados — IDrafty": "Database — iDrafty",
  "MUITA Desvantagem": "Major disadvantage",
  "Selecione um modo ou mapa": "Select a mode or map",
  "Escolher modo ou mapa": "Choose a mode or map",
  "Vantagem no modo de jogo": "Advantage in this game mode",
  "Buscar brawler para classificar como META ou Sub-META":
    "Search for a Brawler to mark as META or Sub-META",
  "Remover META de": "Remove META from",
  "Remover Sub-META de": "Remove Sub-META from",
  "Nenhum brawler modificado.": "No Brawlers have been changed.",
  "JSON gerado. Copie o texto para salvar ou compartilhar.":
    "JSON created. Copy the text to save or share it.",
  "Nenhuma regra de matchup personalizada.": "No custom matchup rules.",
  "Como o Banco funciona": "How the Database works",
  "Veja os registros": "View the records",
  "Selecione Alli nesta lista para trocar o primeiro brawler do matchup.":
    "Select Alli from this list to change the first Brawler in the matchup.",
  "Altere os brawlers do modo": "Change the mode's Brawlers",
  "Redefina o modo ao original": "Restore the mode defaults",
  "Abra os detalhes para consultar os valores atuais. Editar permite marcar cada brawler como melhor, pior ou neutro.":
    "Open the details to review current ratings. Edit lets you mark each Brawler as best, worst, or neutral.",
  "Edite os dados do mapa": "Edit map data",
  "Feche os detalhes do mapa": "Close map details",
  "Clique no X para fechar este painel e voltar ao Banco.":
    "Select X to close this panel and return to the Database.",
  "Redefina o mapa ao original": "Restore the map defaults",
  "Gerencie e compartilhe suas regras de matchups, tiers, mapas e modos.":
    "Manage and share your matchup, tier, map, and mode rules.",
  "Adicionar matchup": "Add matchup",
  "Vantagem / Desvantagem (-5 a +5)": "Advantage / disadvantage (-5 to +5)",
  "Adicionar outro modo ou mapa": "Add another mode or map",
  "Por que existe essa vantagem? (opcional)": "Why does this advantage exist? (optional)",
  "Consultar, editar ou excluir matchups da base (": "View, edit, or delete database matchups (",
  "Escolha um modo": "Choose a mode",
  "Nenhum mapa cadastrado para este modo.": "No maps are registered for this mode.",
  "Recomendado para o modo": "Recommended for this mode",
  "Nenhum brawler recomendado para este modo. Use “Editar” para adicionar.":
    "No Brawlers are recommended for this mode. Select “Edit” to add some.",
  "Nenhum brawler recomendado para este mapa.": "No Brawlers are recommended for this map.",
  "Exportar regras": "Export rules",
  "Importar regras": "Import rules",
  "Copie o texto JSON para salvar ou compartilhar suas regras.":
    "Copy the JSON text to save or share your rules.",
  "Cole abaixo o texto JSON para importar suas regras.":
    "Paste your JSON text below to import your rules.",
  "Texto JSON para importar": "JSON text to import",
  "Vantagem no modo": "Mode advantage",
  "Vantagem forte contra": "Strong advantage against",
  "Desvantagem forte contra": "Strong disadvantage against",
  "Nenhum destaque identificado.": "No strengths identified.",
  "Nenhum brawler selecionado.": "No Brawler selected.",
  "Escolha ao menos um aliado para analisar.": "Choose at least one teammate to analyze.",
  "Nenhum problema identificado.": "No issues identified.",
  "Escolha modo e mapa": "Choose a mode and map",
  "Com o mapa definido, toque em Escolher moeda para continuar.":
    "Once the map is set, select Choose side to continue.",
  "Escolha a moeda azul ou vermelha para definir a ordem dos seis picks.":
    "Choose the blue or red side to set the order of the six picks.",
  "Sua Equipe escolhe agora": "Your team picks now",
  "Uma sequência clara para preparar a partida e adaptar seu plano conforme as escolhas aparecem.":
    "A clear sequence to prepare for the match and adapt your plan as picks are made.",
  "Modo, mapa e ordem de escolha.": "Mode, map, and pick order.",
  "Registre os picks e bans.": "Track picks and bans.",
  "Compare respostas e feche a comp.": "Compare responses and complete your team.",
  "Veja a nota geral, cada matchup e a sinergia com sua equipe para entender o que pesa no ranking.":
    "Review the overall score, each matchup, and team synergy to understand the ranking.",
  "Consulte counters, fraquezas e matchups de cada brawler.":
    "Review each Brawler's counters, weaknesses, and matchups.",
  "Escolha um brawler": "Choose a Brawler",
  "Adapte o iDraft da forma que desejar. Você pode controlar as vantagens e desvantagens dentro da aba de Banco.":
    "Customize iDrafty as you like. Adjust strengths and weaknesses in the Database section.",
  "iDrafty — Estratégia para seu draft": "iDrafty — Strategy for your draft",
  "Planeje seu draft de Brawl Stars, compare matchups e monte sua composição com mais contexto.":
    "Plan your Brawl Stars draft, compare matchups, and build your team with more context.",
  "Recomendações de picks e last picks para o Ranqueado de Brawl Stars.":
    "Pick and last-pick recommendations for Brawl Stars Ranked.",
  "ATENÇÃO:": "WARNING:",
  "Possível last pick:": "Possible last pick:",
  "Terreno favorável": "Favorable terrain",
  "(posição": "(slot",
  "Composição:": "Team rating:",
  "Compare as equipes": "Compare the teams",
  "Zona Estratégica": "Hot Zone",
  "Caça-Estrelas": "Bounty",
};

const extraData: Record<string, string> = {
  // Nomes dos mapas em português brasileiro; Pit Stop mantém o nome original.
  "Duplo Redemoinho": "Double Swoosh",
  "Mina Rochosa": "Hard Rock Mine",
  "Forte de Gemas": "Gem Fort",
  "Fliperama de Cristal": "Crystal Arcade",
  "Mina Subterrânea": "Undermine",
  "Ponte Distante": "Bridge Too Far",
  "Batata Quente": "Hot Potato",
  "Drible Triplo": "Triple Dribble",
  "Tiro de Meta": "Pinhole Punt",
  "Pintando o Pinball": "Pinball Dreams",
  "Pit Stop": "Pit Stop",
  "Zona Segura": "Safe Zone",
  "Cânion Kaboom": "Kaboom Canyon",
  "Estrela Cadente": "Shooting Star",
  "Centro do Palco": "Center Stage",
  "Campos Furtivos": "Sneaky Fields",
  "Bola de Praia": "Beach Ball",
  "Anel de Fogo": "Ring of Fire",
  Aberto: "Open Business",
  "Besouros Brigões": "Dueling Beetles",
  "Jogadas Paralelas": "Parallel Plays",
  "Rocha da Belle": "Belle's Rock",
  "Fênix Flamejante": "Flaring Phoenix",
  "Nascentes Correntes": "Flowing Springs",
  "Estação Seca": "Dry Season",
  Tocaia: "Hideout",
  "Bolo em Camadas": "Layer Cake",
  "Caverna do Braço Dourado": "Goldarm Gulch",
  "Novos Horizontes": "New Horizons",
  Descampado: "Out in the Open",
  Corvo: "Crow",
  Eugênio: "Gene",
  "8-BIT": "8-Bit",
  "Mister P": "Mr. P",
  "Wattson (Surge)": "Surge",
  "Coronel Ruffs": "Ruffs",
  "Lightyear (indisponível)": "Buzz Lightyear",
  "Sapos Voltaicos": "Thunder Frogs",
  "Pique-Gema": "Gem Grab",
  Roubo: "Heist",
  "Caça-Estrelas": "Bounty",
  "Fute-Brawl": "Brawl Ball",
  "Zona Estratégica": "Hot Zone",
  Nocaute: "Knockout",
  Inicial: "Starting",
  Raro: "Rare",
  "Super-raro": "Super Rare",
  Épico: "Epic",
  Mítico: "Mythic",
  Lendário: "Legendary",
  Ultralendário: "Ultra Legendary",
  Indisponível: "Unavailable",
  Dano: "Damage",
  Tanque: "Tank",
  Atirador: "Marksman",
  Assassino: "Assassin",
  Suporte: "Support",
  Controle: "Controller",
  Artilharia: "Artillery",
  curto: "Short",
  medio: "Medium",
  longo: "Long",
  Confirmado: "Verified",
  "Fonte externa": "External source",
  "Avaliação manual": "Manual rating",
  Estimativa: "Estimate",
  "Não verificado": "Unverified",
  confirmado: "verified",
  fonte_externa: "external source",
  avaliacao_manual: "manual rating",
  estimativa: "estimate",
  nao_verificado: "unverified",
  "Draft finalizado": "Draft complete",
  "Draft finalizado!": "Draft complete!",
  Finalizado: "Complete",
  Finalizada: "Complete",
  "Finalizado!": "Complete!",
  Pick: "Pick",
  " de ": " of ",
  "Moeda Azul": "Blue Side",
  "Moeda Vermelha": "Red Side",
  "Selecionado:": "Selected:",
};

const extraDraftBank: Record<string, string> = {
  "Avance para a ordem": "Continue to pick order",
  "Continue o draft": "Continue the draft",
  "Draft — IDrafty": "Draft — iDrafty",
  "Comece o draft": "Start the draft",
  "Sua Equipe": "Your team",
  "Desfazer pick": "Undo pick",
  Anterior: "Previous",
  "Geral — todos os modos e mapas": "General — all modes and maps",
  "Escolha Alli": "Choose Alli",
  "Dados de modos e mapas": "Mode and map data",
  "Classifique os brawlers": "Rate the Brawlers",
  "Entre na categoria Mapas e modos": "Open the Maps and Modes category",
  "Mapas e modos": "Maps and modes",
  "Melhores:": "Best:",
  Piores: "Worst",
  "Ver modo": "View mode",
  "Modos e mapas (opcional)": "Modes and maps (optional)",
  "Salvar matchup": "Save matchup",
  "Matchups personalizados": "Custom matchups",
  "Regras que você adicionou, exibidas separadamente das matchups padrão do app.":
    "Rules you added, shown separately from the app's default matchups.",
  "Matchups padrão": "Default matchups",
  "Matchups derivados de counters, hard counters e vantagens registradas no guia.":
    "Matchups based on counters, hard counters, and advantages recorded in the guide.",
  "Adicionar matchup": "Add matchup",
  "Criar uma regra personalizada para um confronto": "Create a custom rule for a matchup",
  "Escolher modo ou mapa": "Choose a mode or map",
  "Escolha Geral ou um modo para ver a opção do modo e os mapas disponíveis.":
    "Choose General or a mode to see the mode option and available maps.",
  Geral: "General",
  "Vantagem no modo de jogo": "Advantage in this game mode",
  "Nenhuma regra de matchup personalizada.": "No custom matchup rules.",
  "Editar matchup": "Edit matchup",
  "Excluir matchup": "Delete matchup",
  "Excluir matchup do guia": "Delete guide matchup",
  "Adicionar outro modo ou mapa": "Add another mode or map",
  Justificativa: "Explanation",
  "Salvar alterações": "Save changes",
  "Vantagem Absurda": "Overwhelming advantage",
  "Grande Vantagem": "Strong advantage",
  Vantagem: "Advantage",
  Neutro: "Neutral",
  Melhor: "Best",
  Pior: "Worst",
  Desvantagem: "Disadvantage",
  "Grande Desvantagem": "Strong disadvantage",
  "MUITA Desvantagem": "Major disadvantage",
  "Desvantagem Absurda": "Overwhelming disadvantage",
  "Modo ou mapa": "Mode or map",
  "Selecione um modo ou mapa": "Select a mode or map",
  "Somente brawlers com alterações personalizadas. Você pode ajustar a classificação abaixo.":
    "Only Brawlers with custom changes. You can adjust their ratings below.",
  "Nenhuma recomendação personalizada para mapas ou modos.":
    "No custom recommendations for maps or modes.",
  "Nenhum mapa cadastrado para este modo.": "No maps registered for this mode.",
  "Restaurar original": "Restore original",
  "Restaurar alterações para o código": "Restore changes from source",
  "Escolha um modo": "Choose a mode",
  "Selecione um modo para ver os mapas da rotação e os melhores brawlers recomendados.":
    "Select a mode to see its map rotation and recommended Brawlers.",
  "Recomendado para o modo": "Recommended for this mode",
  "Nenhum brawler recomendado para este modo. Use “Editar” para adicionar.":
    "No Brawlers recommended for this mode. Select “Edit” to add some.",
  "Todos os Brawlers": "All Brawlers",
  mapas: "maps",
  "melhores ·": "best ·",
  Melhores: "Best",
  "Importar texto": "Import text",
  "Bom no modo": "Good for this mode",
  "Bom no mapa": "Good on this map",
  "Mapas de destaque:": "Featured maps:",
  "Gerenciar META e Sub-META": "Manage META and Sub-META",
  "Abra os matchups cadastrados": "Open saved matchups",
  "Abra um registro": "Open a record",
  "Abra o campo do primeiro brawler": "Open the first Brawler field",
  "Restaure os matchups": "Restore the matchups",
  "Dados de Meta": "Meta data",
  "Reverter original": "Restore original",
  "Justificativa (opcional)": "Explanation (optional)",
  "Filtrar por Brawler": "Filter by Brawler",
  "Fortes:": "Strengths:",
  "Fracos:": "Weaknesses:",
  "Sem dados de matchup contra": "No matchup data against",
  "Inimigo NÃO JOGA": "Enemy CANNOT PLAY",
  "Marcar META": "Mark META",
  "Remover META de": "Remove META from",
  "Marcar Sub-META": "Mark Sub-META",
  "Remover Sub-META de": "Remove Sub-META from",
};

export const messages = {
  en: {
    Composição: "Composition",
    Banco: "Database",
    "Acompanhe o iDrafty": "Follow iDrafty",
    "Escolha mapa, modo e brawlers. A análise atualiza sozinha.":
      "Choose a map, mode, and Brawlers. The analysis updates automatically.",
    "Pronto para montar o draft?": "Ready to build your draft?",
    "Comece para escolher o modo e o mapa da partida.": "Start by choosing the match mode and map.",
    Começar: "Start",
    "Escolha o modo": "Choose a mode",
    "Escolha o mapa": "Choose a map",
    Escolher: "Choose",
    "Modo e mapa da partida": "Match mode and map",
    "Modo não selecionado": "No mode selected",
    "Selecione um brawler": "Select a Brawler",
    Alterar: "Change",
    Salvar: "Save",
    Cancelar: "Cancel",
    Editar: "Edit",
    Restaurar: "Restore",
    Pesquisar: "Search",
    Todos: "All",
    Modo: "Mode",
    Mapa: "Map",
    Vantagem: "Advantage",
    Desvantagem: "Disadvantage",
    Neutro: "Neutral",
    Português: "Portuguese",
    "Draft strategy": "Draft strategy",
    "Draft guiado": "Guided draft",
    "Matchups contextualizados": "Contextual matchups",
    "Selecione quem deseja banir. O draft começa automaticamente em 10 segundos.":
      "Select the Brawlers you want to ban. The draft starts automatically in 10 seconds.",
    "O guia não tem brawlers destacados para este mapa.":
      "The guide has no featured Brawlers for this map.",
    "Etapa 1 de 3": "Step 1 of 3",
    "Etapa 2 de 3": "Step 2 of 3",
    "Etapa 3 de 3": "Step 3 of 3",
    "Escolher moeda": "Choose side",
    "Escolha moeda azul": "Choose blue side",
    "Escolha moeda vermelha": "Choose red side",
    "Sua vez — escolher": "Your turn — choose",
    "Picks registrados": "Picks recorded",
    "Sugestões para sua equipe": "Suggestions for your team",
    "Melhores respostas": "Best responses",
    "Caminhos de draft": "Draft strategies",
    "Risco:": "Risk:",
    "Sugestões calculadas com base nos picks adversários, nos seus picks e no mapa.":
      "Suggestions based on the opponent's picks, your picks, and the map.",
    "Ver recomendações até a quinta posição": "View recommendations through rank five",
    "Voltar às três primeiras recomendações": "Back to the top three recommendations",
    "Último pick": "Last pick",
    "Análise de last pick": "Last pick analysis",
    "Mais detalhes": "More details",
    "Draft completo": "Draft complete",
    "Monte o draft do Ranqueado e receba recomendações de pick em tempo real.":
      "Build your Ranked draft and get real-time pick recommendations.",
    "Analise as melhores últimas opções para ganhar do time adversário.":
      "Find the best last pick options to beat the opposing team.",
    "Analise cada brawler e veja suas vantagens e desvantagens.":
      "Analyze each Brawler and see its strengths and weaknesses.",
    "Central de draft": "Draft hub",
    "Page not found": "Page not found",
    "The page you're looking for doesn't exist or has been moved.":
      "The page you're looking for doesn't exist or has been moved.",
    "Go home": "Go home",
    "This page didn't load": "This page didn't load",
    "Something went wrong on our end. You can try refreshing or head back home.":
      "Something went wrong on our end. You can try refreshing or head back home.",
    "Try again": "Try again",
    "Banco de dados": "Database",
    "Last Pick": "Last Pick",
    Matchups: "Matchups",
    Draft: "Draft",
    "Por que o #1?": "Why is this #1?",
    "Registre os adversários": "Add the opposing picks",
    "Compare as opções": "Compare your options",
    "Escolha um candidato": "Choose a candidate",
    "Ir para o draft →": "Go to draft →",
    "Registre os adversários no draft para ver o ranking.":
      "Add the opposing picks in the draft to see the ranking.",
    "Avaliação conjunta contra os adversários, com penalidade para matchups muito desfavoráveis.":
      "Combined evaluation against opponents, with penalties for very unfavorable matchups.",
    "Nenhum adversário selecionado.": "No opponents selected.",
    "Ver detalhes da nota de": "View rating details for",
    "Vulnerabilidades (maior = menos)": "Weaknesses (higher = fewer)",
    "Modo + mapa": "Mode + map",
    Cobertura: "Coverage",
    "Abra o seletor e use a busca para encontrar quem deseja analisar.":
      "Open the picker and search for the Brawler you want to analyze.",
    "As listas mostram matchups favoráveis e desfavoráveis com os dados disponíveis.":
      "The lists show favorable and unfavorable matchups based on available data.",
    Indisponível: "Unavailable",
    "Sem dados de matchup": "No matchup data",
    "Vantagem Absurda": "Overwhelming advantage",
    "Grande Vantagem": "Strong advantage",
    "Desvantagem Absurda": "Overwhelming disadvantage",
    "Grande Desvantagem": "Strong disadvantage",
    "Impossível Jogar": "Unplayable",
    "Dados editáveis": "Editable data",
    "Central de estratégia · Brawl Stars": "Brawl Stars strategy hub",
    "Cansado de": "Tired of",
    "pickar mal?": "making bad picks?",
    "O draft vem antes da gameplay. Ganhe no draft e facilite a sua partida. O iDrafty analisa todo o contexto do jogo e te recomenda o melhor brawler para cada situação.":
      "The draft comes before gameplay. Win the draft and make your match easier. iDrafty analyzes the full game context and recommends the best Brawler for every situation.",
    "Abrir central de draft": "Open draft hub",
    "Conhecer ferramentas": "Explore tools",
    "Draft ao vivo": "Live draft",
    "Leitura da partida": "Match overview",
    "Resposta recomendada": "Recommended response",
    "Vantagem recomendada": "Recommended advantage",
    Adversário: "Opponent",
    "Análise de matchup": "Matchup analysis",
    "Compare ameaças, sinergias e opções": "Compare threats, synergies, and options",
    "Leia o jogo. Controle as escolhas.": "Read the game. Control the picks.",
    "Seu arsenal estratégico": "Your strategic toolkit",
    "Decisões melhores, em cada etapa.": "Make better decisions at every stage.",
    "Da leitura do mapa à composição final, tenha mais contexto para escolher.":
      "From map analysis to your final team composition, get more context for every pick.",
    Explorar: "Explore",
    "Fluxo de draft": "Draft flow",
    "Do mapa ao último pick.": "From map to last pick.",
    "Sua próxima partida começa aqui": "Your next match starts here",
    "Entre no draft com um plano.": "Enter the draft with a plan.",
    "Começar agora": "Get started",
    PASSO: "STEP",
    "Reiniciar Draft": "Reset draft",
    "Escolha o modo e o mapa": "Choose a mode and map",
    "Escolha quem começa": "Choose who goes first",
    "Sugestão de Bans": "Suggested bans",
    Banir: "Ban",
    Banido: "Banned",
    "Minha equipe": "My team",
    "Equipe adversária": "Enemy team",
    "SUA VEZ": "YOUR TURN",
    "Notas individuais": "Individual ratings",
    "Pontos fortes": "Strengths",
    Riscos: "Risks",
    "Brawler selecionado": "Selected Brawler",
    "Buscar brawler…": "Search Brawlers…",
    Brawler: "Brawler",
    Candidato: "Candidate",
    Sinergia: "Synergy",
    Nota: "Score",
    "Vence (counters favoráveis)": "Wins (favorable matchups)",
    "Perde (matchups desfavoráveis)": "Loses (unfavorable matchups)",
    "Sem dados registrados.": "No data recorded.",
    Tutorial: "Tutorial",
    "Pular tutorial": "Skip tutorial",
    Voltar: "Back",
    Próximo: "Next",
    Concluir: "Finish",
    "Etapa anterior": "Previous step",
    Inglês: "English",
    "Português (Brasil)": "Português (Brasil)",
    ...extraEn,
    ...extraUi,
    ...extraData,
    ...extraDraftBank,
  },
  "pt-BR": {},
} as const;

export function t(text: string, locale: Locale): string {
  if (locale === "pt-BR") return text;
  return (messages.en as Record<string, string>)[text] ?? text;
}
