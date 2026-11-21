import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Download,
  Info,
  Map as MapIcon,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MatchupChip, Portrait, StatusBadge } from "@/components/draft/ui-bits";
import { MapImage } from "@/components/draft/MapImage";
import { PageTutorial } from "@/components/draft/PageTutorial";
import { getGuideEntry, getMatchupGuideEntry } from "@/data/strategy-guide";
import { getGuideMatchup } from "@/lib/draft/engine";
import {
  createCustomRulesBackup,
  getDefaultMapBrawlers,
  getDefaultModeBrawlers,
  isGuideMatchupOverride,
  parseCustomRulesBackup,
  useDraft,
} from "@/lib/draft/store";
import type {
  Brawler,
  BrawlerRarity,
  GameMap,
  Matchup,
  Mode,
  StrategicTier,
} from "@/lib/draft/types";
import { displayBrawlerName, displayModeName, displayRarity, useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/banco")({
  head: () => ({
    meta: [
      { title: "Banco de dados — IDrafty" },
      {
        name: "description",
        content: "Consulte e atualize brawlers, modos, mapas e matchups da base estratégica.",
      },
      { property: "og:title", content: "Banco de dados — IDrafty" },
      {
        property: "og:description",
        content: "Consulte e atualize brawlers, modos, mapas e matchups da base estratégica.",
      },
    ],
  }),
  component: Banco,
});

const PAGE_SIZE = 25;
const MATCHUP_SCORE_LABELS: Record<number, string> = {
  5: "Inimigo NÃO JOGA",
  4: "Vantagem Absurda",
  3: "MUITA Vantagem",
  2: "Grande Vantagem",
  1: "Vantagem",
  0: "Neutro",
  [-1]: "Desvantagem",
  [-2]: "Grande Desvantagem",
  [-3]: "MUITA Desvantagem",
  [-4]: "Desvantagem Absurda",
  [-5]: "Impossível Jogar",
};
const RARITY_ORDER: BrawlerRarity[] = [
  "Inicial",
  "Raro",
  "Super-raro",
  "Épico",
  "Mítico",
  "Lendário",
  "Ultralendário",
  "Indisponível",
];

function MatchupPagination({
  page,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const { locale } = useLocale();
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) return null;

  const firstItem = (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        {locale === "en"
          ? `Showing ${firstItem}–${lastItem} of ${totalItems}`
          : `Exibindo ${firstItem}–${lastItem} de ${totalItems}`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {locale === "en" ? "Previous" : "Anterior"}
        </Button>
        <span>
          {locale === "en" ? `Page ${page} of ${totalPages}` : `Página ${page} de ${totalPages}`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {locale === "en" ? "Next" : "Próxima"}
        </Button>
      </div>
    </div>
  );
}

function BrawlerSelector({
  label,
  brawlers,
  value,
  onChange,
}: {
  label: string;
  brawlers: Brawler[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedBrawler = brawlers.find((brawler) => brawler.id === value);
  const filteredBrawlers = useMemo(
    () =>
      [...brawlers]
        .filter((brawler) =>
          [brawler.name, brawler.imageAlias ?? ""].some((name) =>
            name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)),
          ),
        )
        .sort((a, b) =>
          displayBrawlerName(a, locale).localeCompare(displayBrawlerName(b, locale), locale),
        ),
    [brawlers, search, locale],
  );

  return (
    <div className="space-y-1.5 text-xs">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        aria-label={`Escolher ${label.toLocaleLowerCase("pt-BR")}`}
        data-tutorial={label === "Brawler" ? "bank-matchup-attacker" : undefined}
        onClick={() => setOpen(true)}
        className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {selectedBrawler ? (
          <>
            <Portrait brawler={selectedBrawler} size="md" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {displayBrawlerName(selectedBrawler, locale)}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {displayRarity(selectedBrawler.rarity, locale)}
              </span>
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">Selecione um brawler</span>
        )}
        <span className="shrink-0 text-xs font-semibold text-primary">Alterar</span>
      </button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch("");
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Escolher {label.toLocaleLowerCase("pt-BR")}</DialogTitle>
            <DialogDescription>
              Selecione o brawler pelo retrato ou use a busca para encontrá-lo.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label={`Buscar ${label.toLocaleLowerCase("pt-BR")}`}
            placeholder="Buscar brawler..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {filteredBrawlers.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {filteredBrawlers.map((brawler) => {
                const selected = brawler.id === value;
                return (
                  <button
                    key={brawler.id}
                    type="button"
                    data-tutorial={
                      brawler.id === "alli" && label === "Brawler" ? "bank-matchup-alli" : undefined
                    }
                    disabled={brawler.available === false}
                    aria-pressed={selected}
                    onClick={() => {
                      onChange(brawler.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex min-h-16 items-center gap-2 rounded-lg border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border ${
                      selected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <Portrait brawler={brawler} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">
                        {displayBrawlerName(brawler, locale)}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {brawler.available === false
                          ? locale === "en"
                            ? "Unavailable"
                            : "Indisponível"
                          : displayRarity(brawler.rarity, locale)}
                      </span>
                    </span>
                    {selected && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">
              Nenhum brawler encontrado.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchupContextSelector({
  modes,
  maps,
  value,
  onChange,
  excludedContexts,
  allowGeneral = false,
}: {
  modes: Mode[];
  maps: GameMap[];
  value: string;
  onChange: (context: string) => void;
  excludedContexts: ReadonlySet<string>;
  allowGeneral?: boolean;
}) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [activeModeId, setActiveModeId] = useState<string | null>(null);
  const [contextType, contextId] = value.split(":");
  const selectedMap = contextType === "map" ? maps.find((map) => map.id === contextId) : undefined;
  const selectedMode =
    contextType === "mode" ? modes.find((mode) => mode.id === contextId) : undefined;
  const activeMode = modes.find((mode) => mode.id === activeModeId);
  const activeModeMaps = activeMode ? maps.filter((map) => map.mode === activeMode.id) : [];
  const activeModeUnavailable =
    !!activeMode &&
    excludedContexts.has(`mode:${activeMode.id}`) &&
    value !== `mode:${activeMode.id}`;
  const selectContext = (context: string) => {
    onChange(context);
    setOpen(false);
  };

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-h-16 items-center gap-2 rounded-lg border border-border bg-surface p-2">
        {selectedMap ? (
          <MapImage name={selectedMap.name} className="h-12 w-20" />
        ) : selectedMode?.imageUrl ? (
          <img
            src={selectedMode.imageUrl}
            alt=""
            className="h-12 w-20 shrink-0 rounded-lg border border-border bg-card object-contain p-1"
          />
        ) : (
          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-[10px] text-muted-foreground">
            Geral
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
          {selectedMap?.name ??
            (selectedMode ? displayModeName(selectedMode, locale) : undefined) ??
            (allowGeneral ? "Geral" : "Selecione um modo ou mapa")}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setActiveModeId(selectedMode?.id ?? selectedMap?.mode ?? null);
            setOpen(true);
          }}
        >
          {value ? "Alterar" : "Escolher"}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            const mapMode = selectedMap?.mode;
            setActiveModeId(selectedMode?.id ?? mapMode ?? null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Escolher modo ou mapa</DialogTitle>
            <DialogDescription>
              Escolha Geral ou um modo para ver a opção do modo e os mapas disponíveis.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {allowGeneral && (
              <button
                type="button"
                aria-label="Geral — todos os modos e mapas"
                aria-pressed={!value}
                onClick={() => selectContext("")}
                className={`flex size-16 flex-col items-center justify-center gap-1 rounded-lg border transition ${
                  !value
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <MapIcon className="size-6" />
                <span className="text-[10px] font-semibold">Geral</span>
              </button>
            )}
            {modes.map((mode) => {
              const isActive = activeModeId === mode.id;
              const isUnavailable =
                excludedContexts.has(`mode:${mode.id}`) && value !== `mode:${mode.id}`;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-label={displayModeName(mode, locale)}
                  aria-pressed={isActive}
                  title={displayModeName(mode, locale)}
                  disabled={isUnavailable}
                  onClick={() => setActiveModeId(mode.id)}
                  className={`flex size-16 items-center justify-center rounded-lg border p-2 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isActive || selectedMode?.id === mode.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {mode.imageUrl && (
                    <img src={mode.imageUrl} alt="" className="size-10 object-contain" />
                  )}
                </button>
              );
            })}
          </div>
          {activeMode && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold">{displayModeName(activeMode, locale)}</h3>
              <Button
                type="button"
                variant={value === `mode:${activeMode.id}` ? "default" : "outline"}
                className="w-full"
                aria-pressed={value === `mode:${activeMode.id}`}
                disabled={activeModeUnavailable}
                onClick={() => selectContext(`mode:${activeMode.id}`)}
              >
                Vantagem no modo de jogo
              </Button>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {activeModeMaps.map((map) => {
                  const mapContext = `map:${map.id}`;
                  const isSelected = value === mapContext;
                  const isUnavailable = excludedContexts.has(mapContext) && !isSelected;
                  return (
                    <div
                      key={map.id}
                      className={`rounded-lg border p-2 ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border bg-card"
                      }`}
                    >
                      <MapImage name={map.name} className="aspect-video w-full" />
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        disabled={isUnavailable}
                        onClick={() => selectContext(mapContext)}
                        className="mt-2 w-full truncate text-left text-xs font-semibold hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {map.name}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetaTierManager({
  brawlers,
  onTierChange,
  modifiedOnly = false,
  modifiedBrawlerIds,
}: {
  brawlers: Brawler[];
  onTierChange: (brawlerId: string, tier: StrategicTier) => void;
  modifiedOnly?: boolean;
  modifiedBrawlerIds?: ReadonlySet<string>;
}) {
  const { locale } = useLocale();
  const [search, setSearch] = useState("");
  const availableBrawlers = brawlers
    .filter((brawler) => brawler.available !== false)
    .filter((brawler) => !modifiedOnly || modifiedBrawlerIds?.has(brawler.id))
    .filter((brawler) =>
      [brawler.name, brawler.imageAlias ?? ""].some((name) =>
        name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)),
      ),
    )
    .sort((a, b) =>
      displayBrawlerName(a, locale).localeCompare(displayBrawlerName(b, locale), locale),
    );
  const metaCount = brawlers.filter(
    (brawler) => brawler.available !== false && brawler.meta,
  ).length;
  const subMetaCount = brawlers.filter(
    (brawler) => brawler.available !== false && brawler.subMeta,
  ).length;

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      data-tutorial="bank-meta-values"
    >
      <div>
        <h2 className="font-semibold">Gerenciar META e Sub-META</h2>
        <p className="text-sm text-muted-foreground">
          {modifiedOnly
            ? "Somente brawlers com alterações personalizadas. Você pode ajustar a classificação abaixo."
            : "Marque os brawlers como META, Sub-META ou remova a classificação. As mudanças ficam salvas neste navegador e atualizam as recomendações do Draft."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
          🌟 META: {metaCount}
        </span>
        <span className="rounded-full border border-zinc-400/70 bg-zinc-500/25 px-3 py-1 font-semibold text-zinc-100">
          ✨ Sub-META: {subMetaCount}
        </span>
      </div>
      <Input
        aria-label="Buscar brawler para classificar como META ou Sub-META"
        placeholder="Buscar brawler..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {availableBrawlers.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {availableBrawlers.map((brawler) => (
            <div
              key={brawler.id}
              className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 p-2"
            >
              <Portrait brawler={brawler} size="md" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {displayBrawlerName(brawler, locale)}
              </span>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={brawler.meta ? "default" : "outline"}
                  aria-pressed={brawler.meta === true}
                  onClick={() => onTierChange(brawler.id, brawler.meta ? "none" : "meta")}
                  aria-label={`${brawler.meta ? "Remover META de" : "Marcar META"} ${brawler.name}`}
                >
                  META
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={
                    brawler.subMeta
                      ? "border-zinc-300 bg-zinc-400 text-zinc-950 shadow-sm hover:bg-zinc-300 hover:text-zinc-950"
                      : "border-zinc-500/70 text-zinc-300 hover:bg-zinc-500/25 hover:text-zinc-100"
                  }
                  aria-pressed={brawler.subMeta === true}
                  onClick={() => onTierChange(brawler.id, brawler.subMeta ? "none" : "subMeta")}
                  aria-label={`${brawler.subMeta ? "Remover Sub-META de" : "Marcar Sub-META"} ${brawler.name}`}
                >
                  Sub-META
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">
          {modifiedOnly &&
          !brawlers.some(
            (brawler) => brawler.available !== false && modifiedBrawlerIds?.has(brawler.id),
          )
            ? "Nenhum brawler modificado."
            : "Nenhum brawler encontrado."}
        </p>
      )}
    </section>
  );
}

function Banco() {
  const { locale } = useLocale();
  const {
    ds,
    disabledMapIds,
    custom,
    deletedGuideMatchups,
    addCustom,
    importCustomRules,
    deleteMatchup,
    restoreGuideMatchups,
    toggleMapRotation,
    setMapBrawlerTier,
    resetMapGoodBrawlers,
    mapBrawlerOverrides,
    mapBrawlerTierOverrides,
    setModeGoodBrawlers,
    resetModeGoodBrawlers,
    modeBrawlerOverrides,
    setBrawlerTier,
    brawlerTierOverrides,
  } = useDraft();
  const brawlersByRarity = useMemo(
    () =>
      RARITY_ORDER.map((rarity) => ({
        rarity,
        brawlers: ds.brawlers
          .filter((brawler) => brawler.rarity === rarity)
          .sort((a, b) =>
            displayBrawlerName(a, locale).localeCompare(displayBrawlerName(b, locale), locale),
          ),
      })).filter((group) => group.brawlers.length > 0),
    [ds.brawlers, locale],
  );
  const n = (id: string) => {
    const brawler = ds.brawlers.find((b) => b.id === id);
    return brawler ? displayBrawlerName(brawler, locale) : id;
  };
  const [activeDatabaseTab, setActiveDatabaseTab] = useState("matchups");
  const [f, setF] = useState({
    attacker: ds.brawlers[0]!.id,
    defender: ds.brawlers[1]!.id,
    score: 1,
    contexts: [""],
    explanation: "",
  });
  const [detailsMapId, setDetailsMapId] = useState<string | null>(null);
  const [mapBrawlerSearch, setMapBrawlerSearch] = useState("");
  const [isEditingMapBrawlers, setIsEditingMapBrawlers] = useState(false);
  const [selectedModeId, setSelectedModeId] = useState(ds.modes[0]!.id);
  const [modeBrawlerSearch, setModeBrawlerSearch] = useState("");
  const [isEditingModeBrawlers, setIsEditingModeBrawlers] = useState(false);
  const [editingMatchup, setEditingMatchup] = useState<Matchup | null>(null);
  const [originalMatchup, setOriginalMatchup] = useState<Matchup | null>(null);
  const [editingMatchupFromGuide, setEditingMatchupFromGuide] = useState(false);
  const [matchupScore, setMatchupScore] = useState(0);
  const [matchupExplanation, setMatchupExplanation] = useState("");
  const [brawlerFilter, setBrawlerFilter] = useState("all");
  const [matchupAdvantageFilter, setMatchupAdvantageFilter] = useState<
    "all" | "advantage" | "disadvantage"
  >("all");
  const [customPage, setCustomPage] = useState(1);
  const [guidePage, setGuidePage] = useState(1);
  const [exportedRulesText, setExportedRulesText] = useState("");
  const [tutorialMatchupSaved, setTutorialMatchupSaved] = useState(false);
  const [tutorialMapChanged, setTutorialMapChanged] = useState(false);
  const [tutorialModeChanged, setTutorialModeChanged] = useState(false);
  const [tutorialModeRestored, setTutorialModeRestored] = useState(false);
  const [tutorialMapRestored, setTutorialMapRestored] = useState(false);
  const [tutorialEditedMapId, setTutorialEditedMapId] = useState("");
  const [tutorialJsonCopied, setTutorialJsonCopied] = useState(false);
  const [importRulesText, setImportRulesText] = useState("");
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [rulesDialogMode, setRulesDialogMode] = useState<"export" | "import">("export");
  const [rulesTextMessage, setRulesTextMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [skipDeleteConfirmation, setSkipDeleteConfirmation] = useState(false);
  const [skipDeleteConfirmationAfterThis, setSkipDeleteConfirmationAfterThis] = useState(false);
  const [confirmation, setConfirmation] = useState<
    { type: "delete"; matchup: Matchup; fromGuide: boolean } | { type: "restore" } | null
  >(null);
  const guideMatchups = useMemo(() => {
    const pairs = new Set<string>();
    ds.brawlers.forEach((brawler) => {
      const guide = getMatchupGuideEntry(brawler.id);
      const references = [...(guide?.counteredBy ?? []), ...(guide?.hardCounters ?? [])];
      references.forEach((opponentId) => {
        if (!ds.brawlers.some((candidate) => candidate.id === opponentId)) return;
        pairs.add(`${brawler.id}->${opponentId}`);
        pairs.add(`${opponentId}->${brawler.id}`);
      });
    });
    const guideMatchups = [...pairs]
      .flatMap((pair) => {
        const [attacker, defender] = pair.split("->");
        if (!attacker || !defender) return [];
        const result = getGuideMatchup(ds, attacker, defender);
        const matchup = result.entry;
        if (!matchup) return [];
        const isOverridden = custom.some(
          (entry) =>
            entry.attacker === attacker &&
            entry.defender === defender &&
            !entry.mapId &&
            !entry.mode,
        );
        return isOverridden ? [] : [matchup];
      })
      .sort((a, b) => a.attacker.localeCompare(b.attacker) || a.defender.localeCompare(b.defender));
    return guideMatchups;
  }, [ds, custom]);
  const filterMatchups = (matchups: Matchup[]) =>
    matchups.filter((matchup) => {
      const matchesBrawler = brawlerFilter === "all" || matchup.attacker === brawlerFilter;
      const matchesAdvantage =
        matchupAdvantageFilter === "all" ||
        (matchupAdvantageFilter === "advantage" && matchup.score > 0) ||
        (matchupAdvantageFilter === "disadvantage" && matchup.score < 0);
      return matchesBrawler && matchesAdvantage;
    });
  const filteredCustom = filterMatchups(custom);
  const filteredGuide = filterMatchups(guideMatchups);
  const customPageCount = Math.max(1, Math.ceil(filteredCustom.length / PAGE_SIZE));
  const guidePageCount = Math.max(1, Math.ceil(filteredGuide.length / PAGE_SIZE));
  const currentCustomPage = Math.min(customPage, customPageCount);
  const currentGuidePage = Math.min(guidePage, guidePageCount);
  const pagedCustom = filteredCustom.slice(
    (currentCustomPage - 1) * PAGE_SIZE,
    currentCustomPage * PAGE_SIZE,
  );
  const pagedGuide = filteredGuide.slice(
    (currentGuidePage - 1) * PAGE_SIZE,
    currentGuidePage * PAGE_SIZE,
  );
  const guideOverrideCount = custom.filter(isGuideMatchupOverride).length;
  const hasGuideChanges = deletedGuideMatchups.length > 0 || guideOverrideCount > 0;
  const selectedMode = ds.modes.find((mode) => mode.id === selectedModeId) ?? ds.modes[0]!;
  const modeMaps = ds.maps.filter((map) => map.mode === selectedMode.id);
  const selectedModeBrawlers =
    modeBrawlerOverrides[selectedMode.id] ?? getDefaultModeBrawlers(selectedMode.id);
  const modeBrawlersForSelection = ds.brawlers
    .filter((brawler) => brawler.available !== false)
    .filter((brawler) => brawler.available !== false)
    .filter((brawler) =>
      [brawler.name, brawler.imageAlias ?? ""].some((name) =>
        name.toLocaleLowerCase(locale).includes(modeBrawlerSearch.toLocaleLowerCase(locale)),
      ),
    )
    .sort((a, b) =>
      displayBrawlerName(a, locale).localeCompare(displayBrawlerName(b, locale), locale),
    );
  const modeRecommendations = selectedModeBrawlers
    .map((id) => ds.brawlers.find((brawler) => brawler.id === id))
    .filter((brawler): brawler is Brawler => !!brawler)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const overriddenModes = ds.modes.flatMap((mode) => {
    if (!Object.prototype.hasOwnProperty.call(modeBrawlerOverrides, mode.id)) return [];
    const originalBrawlers = getDefaultModeBrawlers(mode.id);
    const currentBrawlers = modeBrawlerOverrides[mode.id] ?? [];
    const originalBrawlerSet = new Set(originalBrawlers);
    const currentBrawlerSet = new Set(currentBrawlers);
    const added = currentBrawlers.filter((id) => !originalBrawlerSet.has(id));
    const removed = originalBrawlers.filter((id) => !currentBrawlerSet.has(id));
    return added.length || removed.length ? [{ mode, added, removed }] : [];
  });
  const detailsMap = ds.maps.find((map) => map.id === detailsMapId) ?? null;
  const overriddenMaps = ds.maps.flatMap((map) => {
    const tierChanges = Object.keys(mapBrawlerTierOverrides[map.id] ?? {});
    if (
      !Object.prototype.hasOwnProperty.call(mapBrawlerOverrides, map.id) &&
      tierChanges.length === 0
    )
      return [];
    const originalBrawlers = getDefaultMapBrawlers(map.id);
    const currentBrawlers = new Set(map.goodBrawlers);
    const originalBrawlerSet = new Set(originalBrawlers);
    const added = map.goodBrawlers.filter((id) => !originalBrawlerSet.has(id));
    const removed = originalBrawlers.filter((id) => !currentBrawlers.has(id));
    const mapTierOverrides = mapBrawlerTierOverrides[map.id] ?? {};
    const bestChanges = [
      ...new Set([
        ...added,
        ...Object.keys(mapTierOverrides).filter((id) => mapTierOverrides[id] === "best"),
      ]),
    ];
    const worstChanges = Object.keys(mapTierOverrides).filter(
      (id) => mapTierOverrides[id] === "worst",
    );
    const neutralChanges = [
      ...new Set([
        ...removed,
        ...Object.keys(mapTierOverrides).filter((id) => mapTierOverrides[id] === "neutral"),
      ]),
    ].filter((id) => !worstChanges.includes(id) && !bestChanges.includes(id));
    return added.length || removed.length || tierChanges.length
      ? [{ map, bestChanges, worstChanges, neutralChanges }]
      : [];
  });
  const mapBrawlersForDetails = ds.brawlers
    .filter((brawler) => brawler.available !== false)
    .filter((brawler) =>
      [brawler.name, brawler.imageAlias ?? ""].some((name) =>
        name.toLocaleLowerCase(locale).includes(mapBrawlerSearch.toLocaleLowerCase(locale)),
      ),
    )
    .sort((a, b) =>
      displayBrawlerName(a, locale).localeCompare(displayBrawlerName(b, locale), locale),
    );
  const getMapBrawlerTier = (map: NonNullable<typeof detailsMap>, brawlerId: string) =>
    mapBrawlerTierOverrides[map.id]?.[brawlerId] ??
    (map.goodBrawlers.includes(brawlerId)
      ? "best"
      : getGuideEntry(brawlerId)?.worstMaps.includes(map.id)
        ? "worst"
        : "neutral");
  const bestMapBrawlers = detailsMap
    ? ds.brawlers
        .filter(
          (brawler) =>
            brawler.available !== false && getMapBrawlerTier(detailsMap, brawler.id) === "best",
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : [];
  const worstMapBrawlers = detailsMap
    ? ds.brawlers
        .filter(
          (brawler) =>
            brawler.available !== false && getMapBrawlerTier(detailsMap, brawler.id) === "worst",
        )
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    : [];

  const confirmPendingAction = () => {
    if (confirmation?.type === "delete") {
      if (skipDeleteConfirmationAfterThis) setSkipDeleteConfirmation(true);
      deleteMatchup(confirmation.matchup, confirmation.fromGuide);
    } else if (confirmation?.type === "restore") {
      restoreGuideMatchups();
    }
    setConfirmation(null);
    setSkipDeleteConfirmationAfterThis(false);
  };

  const requestDeleteMatchup = (matchup: Matchup, fromGuide = false) => {
    if (skipDeleteConfirmation) {
      deleteMatchup(matchup, fromGuide);
      return;
    }
    setSkipDeleteConfirmationAfterThis(false);
    setConfirmation({ type: "delete", matchup, fromGuide });
  };

  const editMatchup = (matchup: Matchup, fromGuide = false) => {
    setTutorialMatchupSaved(false);
    setEditingMatchup(matchup);
    setOriginalMatchup(matchup);
    setEditingMatchupFromGuide(fromGuide);
    setMatchupScore(matchup.score);
    setMatchupExplanation(matchup.explanation);
  };

  const saveMatchup = () => {
    if (!editingMatchup || !originalMatchup || editingMatchup.attacker === editingMatchup.defender)
      return;
    const updated: Matchup = {
      ...editingMatchup,
      score: matchupScore,
      explanation: matchupExplanation.trim(),
      source: "manual",
      status: "avaliacao_manual",
      reviewed: new Date().toISOString().slice(0, 10),
    };
    const inverse: Matchup = {
      ...updated,
      attacker: updated.defender,
      defender: updated.attacker,
      score: -updated.score,
      explanation: `Leitura inversa de ${n(updated.attacker)} vs ${n(updated.defender)}.`,
    };
    deleteMatchup(originalMatchup, editingMatchupFromGuide);
    addCustom(updated);
    if (!updated.asymmetric) addCustom(inverse);
    setEditingMatchup(null);
    setOriginalMatchup(null);
    setEditingMatchupFromGuide(false);
    setTutorialMatchupSaved(true);
  };

  const generateRulesText = () => {
    try {
      const backup = createCustomRulesBackup(
        custom,
        deletedGuideMatchups,
        mapBrawlerOverrides,
        modeBrawlerOverrides,
        brawlerTierOverrides,
        mapBrawlerTierOverrides,
      );
      setExportedRulesText(JSON.stringify(backup, null, 2));
      setRulesTextMessage({
        type: "success",
        text: "JSON gerado. Copie o texto para salvar ou compartilhar.",
      });
    } catch (error) {
      setRulesTextMessage({
        type: "error",
        text:
          error instanceof Error
            ? `Não foi possível gerar o JSON: ${error.message}`
            : "Não foi possível gerar o JSON.",
      });
    }
  };

  const copyRulesText = async () => {
    try {
      await navigator.clipboard.writeText(exportedRulesText);
      setTutorialJsonCopied(true);
      setRulesTextMessage({ type: "success", text: "JSON copiado para a área de transferência." });
    } catch (error) {
      setRulesTextMessage({
        type: "error",
        text:
          error instanceof Error
            ? `Não foi possível copiar o JSON: ${error.message}`
            : "Não foi possível copiar o JSON.",
      });
    }
  };

  const importRulesFromText = () => {
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(importRulesText);
      } catch {
        throw new Error("O texto não contém JSON válido.");
      }
      const backup = parseCustomRulesBackup(parsed);
      importCustomRules(backup);
      setCustomPage(1);
      setGuidePage(1);
      setRulesTextMessage({
        type: "success",
        text: `${backup.matchups.length} regra(s) importada(s). As regras correspondentes foram atualizadas; as demais foram preservadas.`,
      });
    } catch (error) {
      setRulesTextMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Não foi possível importar as regras.",
      });
    }
  };

  const renderCustomMatchups = () =>
    filteredCustom.length > 0 ? (
      <>
        <MatchupPagination
          page={currentCustomPage}
          totalItems={filteredCustom.length}
          onPageChange={setCustomPage}
        />
        <ul className="space-y-2">
          {pagedCustom.map((m) => (
            <li
              key={`${m.attacker}->${m.defender}:${m.mapId ?? ""}:${m.mode ?? ""}`}
              className="flex items-center gap-3 rounded-lg border border-primary/30 bg-card p-3 text-sm"
            >
              <MatchupChip score={m.score} />
              <span className="flex-1">
                <b>{n(m.attacker)}</b> vs <b>{n(m.defender)}</b>
                {m.mapId && ` · ${ds.maps.find((x) => x.id === m.mapId)?.name}`}
                {m.mode &&
                  ` · Vantagem no modo ${ds.modes.find((mode) => mode.id === m.mode)?.name ?? m.mode}`}
                {m.explanation && ` — ${m.explanation}`}
              </span>
              <button
                onClick={() => editMatchup(m)}
                aria-label={`Editar matchup de ${n(m.attacker)} contra ${n(m.defender)}`}
              >
                <Pencil className="size-4 text-muted-foreground hover:text-primary" />
              </button>
              <button
                type="button"
                onClick={() => requestDeleteMatchup(m)}
                aria-label={`Excluir matchup de ${n(m.attacker)} contra ${n(m.defender)}`}
                title="Excluir matchup"
              >
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
        <MatchupPagination
          page={currentCustomPage}
          totalItems={filteredCustom.length}
          onPageChange={setCustomPage}
        />
      </>
    ) : (
      <p className="rounded-lg bg-surface p-4 text-sm text-muted-foreground">
        Nenhuma regra de matchup personalizada.
      </p>
    );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Banco de dados</h1>
        <p className="text-sm text-muted-foreground">
          Consulte e personalize os dados usados nas recomendações. Suas alterações ficam salvas
          neste navegador.
        </p>
      </header>
      <PageTutorial
        pageId="banco"
        revision="7"
        title="Banco de dados"
        steps={[
          {
            title: "Como o Banco funciona",
            description:
              "O Banco guarda os dados que alimentam as recomenda\u00e7\u00f5es. Vamos ver registros reais e os controles que alteram matchups, tiers e recomenda\u00e7\u00f5es por mapa e modo.",
            target: "[data-tutorial='bank-tabs']",
          },
          {
            title: "Abra os matchups cadastrados",
            description:
              "Abra esta se\u00e7\u00e3o para ver confrontos existentes no guia, suas notas, justificativas e status. Voc\u00ea tamb\u00e9m pode filtrar por brawler.",
            target: "[data-tutorial='bank-matchups-trigger']",
            advanceOnTargetClick: true,
          },
          {
            title: "Veja os registros",
            description:
              "Cada linha representa uma regra de confronto usada nas recomenda\u00e7\u00f5es. Use o l\u00e1pis para editar brawlers, contexto, vantagem e justificativa.",
            target: "[data-tutorial='bank-matchups-data']",
          },
          {
            title: "Abra um registro",
            description:
              "Clique no l\u00e1pis para abrir o formul\u00e1rio e alterar este matchup.",
            target: "[data-tutorial='bank-matchup-edit']",
            advanceOnTargetClick: true,
          },
          {
            title: "Abra o campo do primeiro brawler",
            description: `Clique em ${editingMatchup ? n(editingMatchup.attacker) : "8-Bit"} no campo Brawler para abrir a lista de escolhas.`,
            target: "[data-tutorial='bank-matchup-attacker']",
            advanceOnTargetClick: true,
            showInDialog: true,
            dialogSide: "left",
          },
          {
            title: "Escolha Alli",
            description: "Selecione Alli nesta lista para trocar o primeiro brawler do matchup.",
            target: "[data-tutorial='bank-matchup-alli']",
            advanceOnTargetClick: true,
            completed: editingMatchup?.attacker === "alli",
            showInDialog: true,
            dialogSide: "left",
          },
          {
            title: "Salve a altera\u00e7\u00e3o",
            description:
              "Clique em Salvar para gravar o matchup. O pr\u00f3ximo passo aparece quando o salvamento terminar.",
            target: "[data-tutorial='bank-matchup-save']",
            completed: tutorialMatchupSaved,
            showInDialog: true,
            dialogSide: "left",
          },
          {
            title: "Restaure os matchups",
            description:
              "Clique para restaurar os registros padr\u00e3o do guia. Uma janela central pedir\u00e1 confirma\u00e7\u00e3o.",
            target: "[data-tutorial='bank-guide-restore']",
            advanceOnTargetClick: true,
          },
          {
            title: "Confirme a restaura\u00e7\u00e3o",
            description:
              "Confira a confirma\u00e7\u00e3o e clique em Restaurar para recuperar os dados originais dos matchups.",
            target: "[data-tutorial='bank-guide-restore-confirm']",
            completed: !hasGuideChanges,
            showInDialog: true,
          },
          {
            title: "Dados de Meta",
            description:
              "Os brawlers listados mostram as classifica\u00e7\u00f5es atuais. Os bot\u00f5es META e Sub-META alternam cada tier e a busca localiza um brawler.",
            target: "[data-tutorial='bank-tab-meta']",
            completed: activeDatabaseTab === "meta",
          },
          {
            title: "Altere os tiers",
            description:
              "Clique em META ou Sub-META para aplicar a classifica\u00e7\u00e3o; clique novamente no tier ativo para remov\u00ea-lo. As mudan\u00e7as afetam o ranking do Draft e ficam salvas localmente.",
            target: "[data-tutorial='bank-meta-values']",
          },
          {
            title: "Dados de modos e mapas",
            description:
              "Selecione um modo para ver mapas e brawlers recomendados. As recomenda\u00e7\u00f5es podem ser personalizadas para o modo ou para cada mapa.",
            target: "[data-tutorial='bank-tab-modos']",
            completed: activeDatabaseTab === "modos",
          },
          {
            title: "Recomenda\u00e7\u00f5es do modo",
            description:
              "A lista mostra os brawlers cadastrados como melhores para o modo. Use Editar para alterar a sele\u00e7\u00e3o ou Restaurar original para recuperar os dados do guia.",
            target: "[data-tutorial='bank-mode-recommendations']",
          },
          {
            title: "Abra a edi\u00e7\u00e3o do modo",
            description:
              "Use Editar para conferir quais brawlers est\u00e3o recomendados para este modo.",
            target: "[data-tutorial='bank-mode-edit']",
            advanceOnTargetClick: true,
          },
          {
            title: "Altere os brawlers do modo",
            description:
              "Clique nos brawlers para adicion\u00e1-los ou remov\u00ea-los da lista. A altera\u00e7\u00e3o fica salva neste navegador.",
            target: "[data-tutorial='bank-mode-brawler-editor']",
            completed: tutorialModeChanged,
          },
          {
            title: "Conclua a edi\u00e7\u00e3o",
            description:
              "Clique em Concluir para sair do modo de edi\u00e7\u00e3o. Depois, o tour aponta para a op\u00e7\u00e3o de restaurar a lista original.",
            target: "[data-tutorial='bank-mode-edit-done']",
            completed: !isEditingModeBrawlers,
          },
          {
            title: "Redefina o modo ao original",
            description:
              "Restaurar original remove as mudan\u00e7as feitas na lista deste modo e recupera os brawlers recomendados pelo guia.",
            target: "[data-tutorial='bank-mode-reset']",
            completed: tutorialModeRestored,
          },
          {
            title: "Classifica\u00e7\u00f5es por mapa",
            description:
              "Abra os detalhes para consultar os valores atuais. Editar permite marcar cada brawler como melhor, pior ou neutro.",
            target: "[data-tutorial='bank-map-details']",
            advanceOnTargetClick: true,
          },
          {
            title: "Edite os dados do mapa",
            description:
              "Clique em Editar para abrir a lista de classifica\u00e7\u00f5es por brawler.",
            target: "[data-tutorial='bank-map-edit']",
            advanceOnTargetClick: true,
            showInDialog: true,
          },
          {
            title: "Classifique os brawlers",
            description:
              "Clique em um brawler para alternar entre neutro, melhor e pior. A altera\u00e7\u00e3o fica salva imediatamente.",
            target: "[data-tutorial='bank-map-dialog']",
            scrollTarget: "[data-tutorial='bank-map-brawler-editor']",
            showInDialog: true,
            completed: tutorialMapChanged,
          },
          {
            title: "Conclua a edi\u00e7\u00e3o do mapa",
            description:
              "Clique em Concluir para sair da edi\u00e7\u00e3o antes de fechar os detalhes.",
            target: "[data-tutorial='bank-map-edit']",
            completed: !isEditingMapBrawlers,
            showInDialog: true,
          },
          {
            title: "Feche os detalhes do mapa",
            description: "Clique no X para fechar este painel e voltar ao Banco.",
            target: "[data-tutorial='bank-map-close']",
            completed: !detailsMap,
            showInDialog: true,
          },
          {
            title: "Personaliza\u00e7\u00f5es",
            description:
              "Abra Personalizado para acessar as regras e altera\u00e7\u00f5es guardadas no navegador.",
            target: "[data-tutorial='bank-custom-tab']",
            completed: activeDatabaseTab === "personalizado",
          },
          {
            title: "Categorias personalizadas",
            description:
              "As abas dividem suas regras entre Matchups, Meta e Mapas e modos. Primeiro confira essas categorias; em seguida, abra Mapas e modos para encontrar a restaura\u00e7\u00e3o.",
            target: "[data-tutorial='bank-custom-tabs']",
          },
          {
            title: "Entre na categoria Mapas e modos",
            description:
              "Selecione Mapas e modos para ver as altera\u00e7\u00f5es dos brawlers por mapa.",
            target: "[data-tutorial='bank-custom-map-rules']",
            advanceOnTargetClick: true,
          },
          {
            title: "Redefina o mapa ao original",
            description:
              "Reverter original remove as altera\u00e7\u00f5es deste mapa e recupera as recomenda\u00e7\u00f5es do guia. Cada mapa pode ser restaurado separadamente.",
            target: "[data-tutorial='bank-map-reset']",
            completed: tutorialMapRestored,
          },
          {
            title: "Exporte um backup JSON",
            description:
              "Exportar JSON gera um texto de backup com suas regras de matchup e altera\u00e7\u00f5es personalizadas de tiers, modos e mapas. Clique para abrir o conte\u00fado exportado.",
            target: "[data-tutorial='bank-export']",
            advanceOnTargetClick: true,
          },
          {
            title: "Revise o conte\u00fado",
            description:
              "A janela mostra o JSON completo do backup. Esse texto representa suas personaliza\u00e7\u00f5es e pode ser armazenado como arquivo para importar depois.",
            target: "[data-tutorial='bank-export-json-text']",
            showInDialog: true,
          },
          {
            title: "Copie o JSON",
            description:
              "Copie o texto para um arquivo ou servi\u00e7o de armazenamento. Use Importar JSON em outro navegador para recuperar as personaliza\u00e7\u00f5es; exportar n\u00e3o publica nada automaticamente.",
            target: "[data-tutorial='bank-export-copy']",
            completed: tutorialJsonCopied,
            showInDialog: true,
          },
        ]}
      />
      <Tabs value={activeDatabaseTab} onValueChange={setActiveDatabaseTab}>
        <TabsList className="grid h-auto w-full grid-cols-4" data-tutorial="bank-tabs">
          <TabsTrigger value="matchups" className="py-2.5">
            Matchups
          </TabsTrigger>
          <TabsTrigger value="meta" className="py-2.5" data-tutorial="bank-tab-meta">
            Meta
          </TabsTrigger>
          <TabsTrigger value="modos" className="py-2.5" data-tutorial="bank-tab-modos">
            Modos
          </TabsTrigger>
          <TabsTrigger value="personalizado" className="py-2.5" data-tutorial="bank-custom-tab">
            Personalizado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personalizado" className="mt-5 space-y-4">
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Personalizado</h2>
                <p className="text-sm text-muted-foreground">
                  Gerencie e compartilhe suas regras de matchups, tiers, mapas e modos.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRulesDialogMode("import");
                    setRulesTextMessage(null);
                    setRulesDialogOpen(true);
                  }}
                >
                  <Upload className="size-4" />
                  Importar JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-tutorial="bank-export"
                  onClick={() => {
                    setRulesDialogMode("export");
                    setRulesTextMessage(null);
                    generateRulesText();
                    setRulesDialogOpen(true);
                  }}
                >
                  <Download className="size-4" />
                  Exportar JSON
                </Button>
              </div>
            </div>
            <Tabs defaultValue="regras-matchups">
              <TabsList data-tutorial="bank-custom-tabs">
                <TabsTrigger value="regras-matchups">
                  Matchups ({filteredCustom.length})
                </TabsTrigger>
                <TabsTrigger value="regras-meta">
                  Meta ({Object.keys(brawlerTierOverrides).length})
                </TabsTrigger>
                <TabsTrigger value="regras-mapas-modos" data-tutorial="bank-custom-map-rules">
                  Mapas e modos ({overriddenMaps.length + overriddenModes.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="regras-matchups" className="mt-4 space-y-3">
                {renderCustomMatchups()}
              </TabsContent>
              <TabsContent value="regras-meta" className="mt-4 space-y-3">
                <MetaTierManager
                  brawlers={ds.brawlers}
                  onTierChange={setBrawlerTier}
                  modifiedOnly
                  modifiedBrawlerIds={new Set(Object.keys(brawlerTierOverrides))}
                />
              </TabsContent>
              <TabsContent value="regras-mapas-modos" className="mt-4">
                <div className="space-y-3">
                  {(overriddenMaps.length > 0 || overriddenModes.length > 0) && (
                    <ul className="space-y-2">
                      {overriddenMaps.map(({ map, bestChanges, worstChanges, neutralChanges }) => (
                        <li
                          key={map.id}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-card p-3 text-sm"
                        >
                          <MapImage name={map.name} className="h-14 w-20" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{map.name}</p>
                            {bestChanges.length > 0 && (
                              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                Melhores: {bestChanges.map(n).join(", ")}
                              </p>
                            )}
                            {worstChanges.length > 0 && (
                              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                                Piores: {worstChanges.map(n).join(", ")}
                              </p>
                            )}
                            {neutralChanges.length > 0 && (
                              <p className="text-sm text-muted-foreground">
                                Neutros: {neutralChanges.map(n).join(", ")}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMapBrawlerSearch("");
                              setIsEditingMapBrawlers(false);
                              setDetailsMapId(map.id);
                            }}
                          >
                            <Info className="size-4" />
                            Detalhes
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              resetMapGoodBrawlers(map.id);
                              if (map.id === tutorialEditedMapId) setTutorialMapRestored(true);
                            }}
                            data-tutorial={
                              map.id === tutorialEditedMapId ? "bank-map-reset" : undefined
                            }
                            aria-label={`Reverter recomendações de ${map.name} para o original`}
                          >
                            Reverter original
                          </Button>
                        </li>
                      ))}
                      {overriddenModes.map(({ mode, added, removed }) => (
                        <li
                          key={mode.id}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-card p-3 text-sm"
                        >
                          {mode.imageUrl ? (
                            <div className="grid size-14 shrink-0 place-items-center rounded-lg border border-border bg-background/40 p-1">
                              <img
                                src={mode.imageUrl}
                                alt={`Imagem do modo ${mode.name}`}
                                loading="lazy"
                                className="size-full object-contain"
                              />
                            </div>
                          ) : (
                            <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary/10 font-display text-lg font-bold text-primary">
                              {mode.name.slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{mode.name}</p>
                            {added.length > 0 && (
                              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                Adicionado{added.length > 1 ? "s" : ""} {added.map(n).join(", ")}
                              </p>
                            )}
                            {removed.length > 0 && (
                              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                                Removido{removed.length > 1 ? "s" : ""} {removed.map(n).join(", ")}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedModeId(mode.id);
                              setIsEditingModeBrawlers(false);
                              setModeBrawlerSearch("");
                              setActiveDatabaseTab("modos");
                            }}
                          >
                            Ver modo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => resetModeGoodBrawlers(mode.id)}
                            aria-label={`Reverter recomendações de ${mode.name} para o original`}
                          >
                            Reverter original
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!overriddenMaps.length && !overriddenModes.length && (
                    <p className="rounded-lg bg-surface p-4 text-sm text-muted-foreground">
                      Nenhuma recomendação personalizada para mapas ou modos.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </TabsContent>

        <TabsContent value="matchups" className="mt-5 space-y-4">
          <Accordion type="multiple" className="space-y-3">
            <AccordionItem
              value="add-matchup"
              className="rounded-xl border border-border bg-card px-4"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <span>
                  <span className="block font-semibold">Adicionar matchup</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Criar uma regra personalizada para um confronto
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <form
                  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (f.attacker === f.defender) return;
                    const selectedContexts = [...new Set(f.contexts.filter(Boolean))];
                    (selectedContexts.length ? selectedContexts : [""]).forEach((context) => {
                      const [type, id] = context.split(":");
                      const mode =
                        type === "mode"
                          ? ds.modes.find((candidate) => candidate.id === id)?.id
                          : undefined;
                      addCustom({
                        attacker: f.attacker,
                        defender: f.defender,
                        score: f.score,
                        mapId: type === "map" ? id : undefined,
                        mode,
                        explanation: f.explanation.trim(),
                        source: "manual",
                        confidence: "media",
                        status: "avaliacao_manual",
                        reviewed: new Date().toISOString().slice(0, 10),
                      });
                    });
                    setCustomPage(1);
                    setF((current) => ({ ...current, contexts: [""], explanation: "" }));
                  }}
                >
                  <BrawlerSelector
                    label="Brawler"
                    brawlers={ds.brawlers}
                    value={f.attacker}
                    onChange={(attacker) => setF((current) => ({ ...current, attacker }))}
                  />
                  <BrawlerSelector
                    label="Contra"
                    brawlers={ds.brawlers}
                    value={f.defender}
                    onChange={(defender) => setF((current) => ({ ...current, defender }))}
                  />
                  <label className="space-y-1.5 text-xs">
                    Vantagem / Desvantagem (-5 a +5)
                    <Select
                      value={String(f.score)}
                      onValueChange={(value) =>
                        setF((current) => ({ ...current, score: Number(value) }))
                      }
                    >
                      <SelectTrigger className="h-16 bg-surface">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5].map((score) => (
                          <SelectItem key={score} value={String(score)}>
                            {score > 0 ? `+${score} | ` : score < 0 ? `${score} | ` : "0 | "}
                            {MATCHUP_SCORE_LABELS[score]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <div className="space-y-2 text-xs">
                    <span className="font-medium">Modos e mapas (opcional)</span>
                    {f.contexts.map((context, index) => {
                      const selectedContexts = new Set(
                        f.contexts.filter((id, contextIndex) => id && contextIndex !== index),
                      );
                      return (
                        <div key={index} className="flex items-center gap-2">
                          <MatchupContextSelector
                            modes={ds.modes}
                            maps={ds.maps}
                            value={context}
                            excludedContexts={selectedContexts}
                            allowGeneral={index === 0}
                            onChange={(selectedContext) =>
                              setF((current) => ({
                                ...current,
                                contexts: current.contexts.map((value, contextIndex) =>
                                  contextIndex === index ? selectedContext : value,
                                ),
                              }))
                            }
                          />
                          {index > 0 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remover mapa adicional ${index}`}
                              onClick={() =>
                                setF((current) => ({
                                  ...current,
                                  contexts: current.contexts.filter(
                                    (_, contextIndex) => contextIndex !== index,
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {f.contexts.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!f.contexts.every(Boolean)}
                        onClick={() =>
                          setF((current) => ({ ...current, contexts: [...current.contexts, ""] }))
                        }
                      >
                        <Plus className="size-4" />
                        Adicionar outro modo ou mapa
                      </Button>
                    )}
                  </div>
                  <label className="text-xs sm:col-span-2">
                    Justificativa (opcional)
                    <Input
                      className="h-16"
                      value={f.explanation}
                      onChange={(e) => setF({ ...f, explanation: e.target.value })}
                      placeholder="Por que existe essa vantagem? (opcional)"
                    />
                  </label>
                  <Button type="submit" className="self-end">
                    Salvar matchup
                  </Button>
                </form>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion type="multiple" className="space-y-3">
            <AccordionItem
              value="custom-matchups"
              className="rounded-xl border border-border bg-card px-4"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <span>
                  <span className="block font-semibold">
                    Matchups personalizados ({filteredCustom.length})
                  </span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Regras que você adicionou, exibidas separadamente das matchups padrão do app.
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <section className="space-y-4 rounded-xl border border-border bg-card p-4">
                  {renderCustomMatchups()}
                </section>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion type="multiple" className="space-y-3">
            <AccordionItem value="guide" className="rounded-xl border border-border bg-card px-4">
              <AccordionTrigger
                className="py-4 hover:no-underline"
                data-tutorial="bank-matchups-trigger"
              >
                <span>
                  <span className="block font-semibold">Matchups padrão</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Consultar, editar ou excluir matchups da base ({filteredGuide.length})
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-1">
                <section className="space-y-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <h2 className="font-semibold">Matchups padrão ({filteredGuide.length})</h2>
                        <p className="text-sm text-muted-foreground">
                          Matchups derivados de counters, hard counters e vantagens registradas no
                          guia.
                        </p>
                      </div>
                      <label>
                        <span className="sr-only">Filtrar por Brawler</span>
                        <Select
                          value={brawlerFilter}
                          onValueChange={(value) => {
                            setBrawlerFilter(value);
                            setCustomPage(1);
                            setGuidePage(1);
                          }}
                        >
                          <SelectTrigger
                            aria-label="Filtrar por Brawler"
                            className="w-auto min-w-44 bg-surface"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os Brawlers</SelectItem>
                            {brawlersByRarity.map((group) => (
                              <SelectGroup key={group.rarity}>
                                <SelectLabel>{group.rarity}</SelectLabel>
                                {group.brawlers.map((brawler) => (
                                  <SelectItem
                                    key={brawler.id}
                                    value={brawler.id}
                                    disabled={brawler.available === false}
                                  >
                                    {brawler.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <label>
                        <span className="sr-only">Filtrar por resultado</span>
                        <Select
                          value={matchupAdvantageFilter}
                          onValueChange={(value) => {
                            if (
                              value !== "all" &&
                              value !== "advantage" &&
                              value !== "disadvantage"
                            )
                              return;
                            setMatchupAdvantageFilter(value);
                            setCustomPage(1);
                            setGuidePage(1);
                          }}
                        >
                          <SelectTrigger
                            aria-label="Filtrar por resultado"
                            className="w-auto min-w-44 bg-surface"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os resultados</SelectItem>
                            <SelectItem value="advantage">Vantagem</SelectItem>
                            <SelectItem value="disadvantage">Desvantagem</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                    {hasGuideChanges && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmation({ type: "restore" })}
                        data-tutorial="bank-guide-restore"
                      >
                        Restaurar alterações para o código
                      </Button>
                    )}
                    <MatchupPagination
                      page={currentGuidePage}
                      totalItems={filteredGuide.length}
                      onPageChange={setGuidePage}
                    />
                  </div>
                  <div
                    className="overflow-x-auto rounded-xl border border-border bg-card"
                    data-tutorial="bank-matchups-data"
                  >
                    <table className="w-full text-sm">
                      <tbody>
                        {pagedGuide.map((matchup) => (
                          <tr
                            key={`${matchup.attacker}->${matchup.defender}`}
                            className="border-t border-border first:border-0"
                          >
                            <td className="p-2">
                              <MatchupChip score={matchup.score} />
                            </td>
                            <td className="p-2 font-semibold whitespace-nowrap">
                              {n(matchup.attacker)} vs {n(matchup.defender)}
                            </td>
                            <td className="p-2 text-muted-foreground">{matchup.explanation}</td>
                            <td className="p-2">
                              <StatusBadge status={matchup.status} />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  data-tutorial="bank-matchup-edit"
                                  onClick={() => editMatchup(matchup, true)}
                                  aria-label={`Editar matchup de ${n(matchup.attacker)} contra ${n(matchup.defender)}`}
                                  title="Editar matchup"
                                >
                                  <Pencil className="size-4 text-muted-foreground hover:text-primary" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteMatchup(matchup, true)}
                                  aria-label={`Excluir matchup de ${n(matchup.attacker)} contra ${n(matchup.defender)}`}
                                  title="Excluir matchup do guia"
                                >
                                  <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredGuide.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-muted-foreground">
                              Nenhum matchup do guia disponível.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <MatchupPagination
                    page={currentGuidePage}
                    totalItems={filteredGuide.length}
                    onPageChange={setGuidePage}
                  />
                  <p className="text-xs text-muted-foreground">
                    Edições e exclusões da base afetam somente este navegador.
                  </p>
                </section>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="meta" className="mt-5 space-y-4">
          <MetaTierManager brawlers={ds.brawlers} onTierChange={setBrawlerTier} />
        </TabsContent>

        <TabsContent value="modos" className="mt-5 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">Escolha um modo</h2>
            <p className="text-sm text-muted-foreground">
              Selecione um modo para ver os mapas da rotação e os melhores brawlers recomendados.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ds.modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={mode.id === selectedMode.id}
                  onClick={() => {
                    setSelectedModeId(mode.id);
                    setModeBrawlerSearch("");
                    setIsEditingModeBrawlers(false);
                  }}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                    mode.id === selectedMode.id
                      ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {mode.imageUrl && (
                    <img
                      src={mode.imageUrl}
                      alt=""
                      loading="lazy"
                      className="size-12 shrink-0 object-contain"
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block font-semibold">{displayModeName(mode, locale)}</span>
                    <span className="text-xs text-muted-foreground">
                      {ds.maps.filter((map) => map.mode === mode.id).length} mapas
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div>
              <h2 className="font-semibold">
                {locale === "en" ? "Maps for" : "Mapas de"} {displayModeName(selectedMode, locale)}{" "}
                ({modeMaps.length})
              </h2>
            </div>
            {modeMaps.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {modeMaps.map((map) => (
                  <div
                    key={map.id}
                    className="flex gap-3 rounded-xl border border-border bg-background/40 p-3 text-sm"
                  >
                    <MapImage name={map.name} className="h-24 w-20 sm:h-28 sm:w-24" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <b className="font-display text-base">{map.name}</b>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMapBrawlerSearch("");
                            setIsEditingMapBrawlers(false);
                            setTutorialMapChanged(false);
                            setTutorialMapRestored(false);
                            setTutorialEditedMapId(map.id);
                            setDetailsMapId(map.id);
                          }}
                          data-tutorial="bank-map-details"
                        >
                          <Info className="size-4" />
                          Detalhes
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-surface p-4 text-sm text-muted-foreground">
                Nenhum mapa cadastrado para este modo.
              </p>
            )}
          </section>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold" data-tutorial="bank-mode-recommendations">
                  {locale === "en" ? "Best Brawlers —" : "Melhores Brawlers —"}{" "}
                  {displayModeName(selectedMode, locale)}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Recomendações do guia estratégico; suas alterações ficam salvas neste navegador.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.prototype.hasOwnProperty.call(modeBrawlerOverrides, selectedMode.id) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetModeGoodBrawlers(selectedMode.id);
                      setTutorialModeRestored(true);
                    }}
                    data-tutorial="bank-mode-reset"
                  >
                    Restaurar original
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-tutorial={isEditingModeBrawlers ? "bank-mode-edit-done" : "bank-mode-edit"}
                  onClick={() => {
                    setIsEditingModeBrawlers((editing) => !editing);
                    setTutorialModeChanged(false);
                    setModeBrawlerSearch("");
                  }}
                >
                  {isEditingModeBrawlers ? "Concluir" : "Editar"}
                </Button>
              </div>
            </div>
            {isEditingModeBrawlers ? (
              <>
                <Input
                  aria-label={`Buscar brawler para ${selectedMode.name}`}
                  placeholder="Buscar brawler..."
                  value={modeBrawlerSearch}
                  onChange={(event) => setModeBrawlerSearch(event.target.value)}
                />
                {modeBrawlersForSelection.length ? (
                  <div
                    className="grid gap-2 sm:grid-cols-2 md:grid-cols-3"
                    data-tutorial="bank-mode-brawler-editor"
                  >
                    {modeBrawlersForSelection.map((brawler) => {
                      const selected = selectedModeBrawlers.includes(brawler.id);
                      return (
                        <button
                          key={brawler.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setModeGoodBrawlers(
                              selectedMode.id,
                              selected
                                ? selectedModeBrawlers.filter((id) => id !== brawler.id)
                                : [...selectedModeBrawlers, brawler.id],
                            );
                            setTutorialModeChanged(true);
                          }}
                          className={`flex min-h-20 items-center gap-3 rounded-lg border p-3 text-left transition ${
                            selected
                              ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                              : "border-border bg-card hover:border-primary/50"
                          }`}
                        >
                          <Portrait brawler={brawler} size="md" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{brawler.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {selected ? "Recomendado para o modo" : "Adicionar"}
                            </span>
                          </span>
                          {selected ? (
                            <Check className="size-4 shrink-0 text-primary" />
                          ) : (
                            <Plus className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">
                    Nenhum brawler encontrado.
                  </p>
                )}
              </>
            ) : modeRecommendations.length ? (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {modeRecommendations.map((brawler) => (
                  <div
                    key={brawler.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
                  >
                    <Portrait brawler={brawler} size="md" />
                    <span className="font-semibold">{brawler.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">
                Nenhum brawler recomendado para este modo. Use “Editar” para adicionar.
              </p>
            )}
          </section>
        </TabsContent>
      </Tabs>
      <Dialog
        open={detailsMap !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsMapId(null);
            setIsEditingMapBrawlers(false);
          }
        }}
      >
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
          data-tutorial="bank-map-dialog"
          closeButtonTutorial="bank-map-close"
        >
          {detailsMap && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3 pr-7">
                  <DialogTitle>Brawlers — {detailsMap.name}</DialogTitle>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-tutorial="bank-map-edit"
                    onClick={() => {
                      setIsEditingMapBrawlers((editing) => !editing);
                      setMapBrawlerSearch("");
                    }}
                  >
                    {isEditingMapBrawlers ? "Concluir" : "Editar"}
                  </Button>
                </div>
                <DialogDescription>
                  {isEditingMapBrawlers
                    ? "Clique em cada brawler para alternar entre neutro, melhor e pior. As alterações ficam salvas neste navegador."
                    : "Brawlers recomendados para este mapa, com base nas sugestões do guia e nas suas alterações."}
                </DialogDescription>
              </DialogHeader>
              <div
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                data-tutorial="bank-map-summary"
              >
                <MapImage name={detailsMap.name} className="h-16 w-24" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{detailsMap.name}</p>
                  <p className="font-semibold">
                    {(() => {
                      const mode = ds.modes.find((candidate) => candidate.id === detailsMap.mode);
                      return mode ? displayModeName(mode, locale) : "";
                    })()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bestMapBrawlers.length} melhores · {worstMapBrawlers.length} piores
                  </p>
                </div>
                <div className="mr-2 flex shrink-0 flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-muted-foreground">Rotação</span>
                  <Switch
                    checked={!disabledMapIds.includes(detailsMap.id)}
                    disabled={!isEditingMapBrawlers}
                    onCheckedChange={() => toggleMapRotation(detailsMap.id)}
                    aria-label={`${disabledMapIds.includes(detailsMap.id) ? "Ativar" : "Desativar"} ${detailsMap.name} na rotação`}
                    className={`disabled:cursor-not-allowed disabled:opacity-70 ${disabledMapIds.includes(detailsMap.id) ? "data-[state=unchecked]:bg-red-600" : "data-[state=checked]:bg-green-600"}`}
                  />
                </div>
              </div>
              {isEditingMapBrawlers ? (
                <section className="space-y-3" data-tutorial="bank-map-brawler-editor">
                  <Input
                    aria-label={`Buscar brawler para ${detailsMap.name}`}
                    placeholder="Buscar brawler..."
                    value={mapBrawlerSearch}
                    onChange={(event) => setMapBrawlerSearch(event.target.value)}
                  />
                  {mapBrawlersForDetails.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {mapBrawlersForDetails.map((brawler) => {
                        const tier = getMapBrawlerTier(detailsMap, brawler.id);
                        const tierLabel =
                          tier === "best" ? "Melhor" : tier === "worst" ? "Pior" : "Neutro";
                        return (
                          <button
                            key={brawler.id}
                            type="button"
                            aria-label={`${brawler.name}: ${tierLabel}. Clique para alterar.`}
                            aria-pressed={tier !== "neutral"}
                            onClick={() => {
                              setMapBrawlerTier(
                                detailsMap.id,
                                brawler.id,
                                tier === "neutral" ? "best" : tier === "best" ? "worst" : "neutral",
                              );
                              setTutorialMapChanged(true);
                            }}
                            className={`flex min-h-20 items-center gap-3 rounded-lg border p-3 text-left transition ${
                              tier === "best"
                                ? "border-green-500/50 bg-green-500/10"
                                : tier === "worst"
                                  ? "border-red-500/50 bg-red-500/10"
                                  : "border-border bg-card hover:border-primary/50"
                            }`}
                          >
                            <Portrait brawler={brawler} size="md" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{brawler.name}</span>
                              <span
                                className={`text-xs ${
                                  tier === "best"
                                    ? "text-green-600 dark:text-green-400"
                                    : tier === "worst"
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {tierLabel}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">
                      Nenhum brawler encontrado.
                    </p>
                  )}
                </section>
              ) : (
                <>
                  <section className="space-y-3">
                    <h3 className="font-bold text-green-600 dark:text-green-400">Melhores</h3>
                    {bestMapBrawlers.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {bestMapBrawlers.map((brawler) => (
                          <div
                            key={brawler.id}
                            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                          >
                            <Portrait brawler={brawler} size="md" />
                            <span className="font-semibold">{brawler.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">
                        Nenhum brawler recomendado para este mapa.
                      </p>
                    )}
                  </section>
                  <section className="space-y-3">
                    <h3 className="font-bold text-red-600 dark:text-red-400">Piores</h3>
                    {worstMapBrawlers.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                        {worstMapBrawlers.map((brawler) => (
                          <div
                            key={brawler.id}
                            className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3"
                          >
                            <Portrait brawler={brawler} size="md" />
                            <span className="font-semibold">{brawler.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted-foreground">
                        Nenhum brawler listado como desfavorável neste mapa.
                      </p>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {rulesDialogMode === "export" ? "Exportar regras" : "Importar regras"}
            </DialogTitle>
          </DialogHeader>
          {rulesDialogMode === "export" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Copie o texto JSON para salvar ou compartilhar suas regras.
              </p>
              <Textarea
                aria-label="Texto JSON exportado"
                value={exportedRulesText}
                readOnly
                rows={12}
                className="font-mono text-xs"
                data-tutorial="bank-export-json-text"
              />
              <Button
                type="button"
                variant="outline"
                data-tutorial="bank-export-copy"
                onClick={() => void copyRulesText()}
                disabled={!exportedRulesText}
              >
                <Clipboard className="size-4" />
                Copiar texto
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cole abaixo o texto JSON para importar suas regras.
              </p>
              <Textarea
                aria-label="Texto JSON para importar"
                placeholder="Cole aqui o JSON das regras."
                value={importRulesText}
                onChange={(event) => setImportRulesText(event.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={importRulesFromText}
                disabled={!importRulesText.trim()}
              >
                Importar texto
              </Button>
            </div>
          )}
          {rulesTextMessage && (
            <p
              className={`text-sm ${rulesTextMessage.type === "error" ? "text-destructive" : "text-muted-foreground"}`}
              role={rulesTextMessage.type === "error" ? "alert" : "status"}
            >
              {rulesTextMessage.text}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent
          data-tutorial={
            confirmation?.type === "restore" ? "bank-guide-restore-confirm" : undefined
          }
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.type === "restore"
                ? "Restaurar alterações do Strategy Guide?"
                : "Excluir matchup?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.type === "restore"
                ? "As edições e exclusões de matchups do guia neste navegador serão removidas. Os dados voltarão a refletir o código-fonte."
                : "Este matchup será removido das recomendações deste navegador."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation?.type === "delete" && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={skipDeleteConfirmationAfterThis}
                onCheckedChange={(checked) => setSkipDeleteConfirmationAfterThis(checked === true)}
              />
              Não perguntar novamente até atualizar o site
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingAction}>
              {confirmation?.type === "restore" ? "Restaurar" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={editingMatchup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMatchup(null);
            setOriginalMatchup(null);
            setEditingMatchupFromGuide(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto" data-tutorial="bank-matchup-editor">
          <DialogHeader>
            <DialogTitle>
              Editar matchup
              {editingMatchup
                ? ` — ${n(editingMatchup.attacker)} vs ${n(editingMatchup.defender)}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {editingMatchup && (
              <>
                <div>
                  <BrawlerSelector
                    label="Brawler"
                    brawlers={ds.brawlers}
                    value={editingMatchup.attacker}
                    onChange={(attacker) =>
                      setEditingMatchup((current) => (current ? { ...current, attacker } : current))
                    }
                  />
                </div>
                <BrawlerSelector
                  label="Contra"
                  brawlers={ds.brawlers}
                  value={editingMatchup.defender}
                  onChange={(defender) =>
                    setEditingMatchup((current) => (current ? { ...current, defender } : current))
                  }
                />
              </>
            )}
          </div>
          {editingMatchup && (
            <div className="space-y-1.5 text-sm font-medium">
              <span>Modo ou mapa</span>
              <MatchupContextSelector
                modes={ds.modes}
                maps={ds.maps}
                value={
                  editingMatchup.mapId
                    ? `map:${editingMatchup.mapId}`
                    : editingMatchup.mode
                      ? `mode:${editingMatchup.mode}`
                      : ""
                }
                excludedContexts={new Set()}
                allowGeneral
                onChange={(context) => {
                  const [type, id] = context.split(":");
                  setEditingMatchup((current) =>
                    current
                      ? {
                          ...current,
                          mapId: type === "map" ? id : undefined,
                          mode:
                            type === "mode"
                              ? ds.modes.find((mode) => mode.id === id)?.id
                              : undefined,
                        }
                      : current,
                  );
                }}
              />
              {editingMatchup.mode && (
                <p className="text-xs font-normal text-muted-foreground">
                  {locale === "en" ? "Advantage in" : "Vantagem no modo"}{" "}
                  {(() => {
                    const mode = ds.modes.find((candidate) => candidate.id === editingMatchup.mode);
                    return mode ? displayModeName(mode, locale) : "";
                  })()}
                  .
                </p>
              )}
            </div>
          )}
          <label className="space-y-1 text-sm font-medium" data-tutorial="bank-matchup-score">
            Vantagem / Desvantagem (-5 a +5)
            <Select
              value={String(matchupScore)}
              onValueChange={(value) => setMatchupScore(Number(value))}
            >
              <SelectTrigger className="h-16 bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 4, 3, 2, 1, 0, -1, -2, -3, -4, -5].map((score) => (
                  <SelectItem key={score} value={String(score)}>
                    {score > 0 ? `+${score} | ` : score < 0 ? `${score} | ` : "0 | "}
                    {MATCHUP_SCORE_LABELS[score]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Justificativa
            <Input
              className="h-16"
              value={matchupExplanation}
              onChange={(event) => setMatchupExplanation(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            A alteração será salva neste navegador e terá prioridade sobre a base original.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingMatchup(null);
                setOriginalMatchup(null);
                setEditingMatchupFromGuide(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveMatchup}
              data-tutorial="bank-matchup-save"
              disabled={!editingMatchup || editingMatchup.attacker === editingMatchup.defender}
            >
              Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
