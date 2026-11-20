import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DemoNotice, MatchupChip, Portrait } from "@/components/draft/ui-bits";
import { PageTutorial } from "@/components/draft/PageTutorial";
import { getMatchup } from "@/lib/draft/engine";
import { useDraft } from "@/lib/draft/store";
import type { BrawlerRarity } from "@/lib/draft/types";
import { cn } from "@/lib/utils";
import { displayBrawlerName, displayRarity, useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/matchups")({
  head: () => ({
    meta: [
      { title: "Matchups — IDrafty" },
      { name: "description", content: "Consulte counters, fraquezas e matchups de cada brawler." },
      { property: "og:title", content: "Matchups — IDrafty" },
      {
        property: "og:description",
        content: "Consulte counters, fraquezas e matchups de cada brawler.",
      },
    ],
  }),
  component: Matchups,
});

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

function Matchups() {
  const { locale } = useLocale();
  const { ds, draft } = useDraft();
  const [sel, setSel] = useState(ds.brawlers[0]!.id);
  const [tutorialBrawlerChosen, setTutorialBrawlerChosen] = useState(false);
  const [q, setQ] = useState("");
  const b = ds.brawlers.find((x) => x.id === sel)!;
  const brawlersByRarity = useMemo(
    () =>
      ds.brawlers.sort(
        (a, z) =>
          RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(z.rarity) ||
          a.name.localeCompare(z.name, "pt-BR"),
      ),
    [ds.brawlers],
  );
  const [brawlerListOpen, setBrawlerListOpen] = useState(false);
  const rows = useMemo(
    () =>
      ds.brawlers
        .filter((o) => o.id !== sel && o.available !== false)
        .map((o) => ({ o, r: getMatchup(ds, sel, o.id, { mapId: draft.mapId, mode: draft.mode }) }))
        .filter((x) => x.r.known)
        .sort((a, z) => z.r.score - a.r.score),
    [ds, sel, draft.mapId, draft.mode],
  );

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Matchups</h1>
      <PageTutorial
        pageId="matchups"
        title="Matchups"
        steps={[
          {
            title: "Escolha um brawler",
            description: "Abra o seletor e use a busca para encontrar quem deseja analisar.",
            target: "[data-tutorial='matchup-selector']",
            completed: tutorialBrawlerChosen,
          },
          {
            title: "Leia os confrontos",
            description:
              "As listas mostram matchups favoráveis e desfavoráveis com os dados disponíveis.",
            target: "[data-tutorial='matchup-results']",
          },
          {
            title: "Adicione contexto",
            description:
              "Quando modo e mapa estiverem definidos no Draft, registros específicos desse contexto têm prioridade.",
            target: "[data-tutorial='matchup-results']",
          },
          {
            title: "Interprete os dados",
            description:
              "Confrontos sem registro não aparecem. Ausência de dados não significa vantagem nem desvantagem.",
            target: "[data-tutorial='matchup-results']",
          },
        ]}
      />
      <div className="space-y-2">
        <button
          data-tutorial="matchup-selector"
          type="button"
          aria-expanded={brawlerListOpen}
          aria-controls="matchup-brawler-list"
          onClick={() => setBrawlerListOpen((open) => !open)}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/50"
        >
          <span className="flex items-center gap-3">
            <Portrait brawler={b} size="sm" />
            <span>
              <span className="block text-xs text-muted-foreground">Brawler selecionado</span>
              <span className="font-semibold">{displayBrawlerName(b, locale)}</span>
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-5 text-muted-foreground transition-transform",
              brawlerListOpen && "rotate-180",
            )}
          />
        </button>
        {brawlerListOpen && (
          <div
            id="matchup-brawler-list"
            className="space-y-3 rounded-xl border border-border bg-card p-3"
          >
            <Input
              placeholder="Buscar brawler…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              autoFocus
            />
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {brawlersByRarity
                .filter((brawler) =>
                  [brawler.name, brawler.imageAlias ?? ""].some((name) =>
                    name.toLowerCase().includes(q.toLowerCase()),
                  ),
                )
                .map((brawler) => (
                  <button
                    key={brawler.id}
                    type="button"
                    disabled={brawler.available === false}
                    aria-pressed={brawler.id === sel}
                    onClick={() => {
                      setSel(brawler.id);
                      if (brawler.id !== sel) setTutorialBrawlerChosen(true);
                      setBrawlerListOpen(false);
                      setQ("");
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-left transition hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
                      brawler.id === sel ? "border-primary bg-primary/10" : "border-border",
                    )}
                  >
                    <Portrait brawler={brawler} size="sm" />
                    <span className="min-w-0">
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
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
      <section
        className="rounded-xl border border-border bg-card p-4"
        data-tutorial="matchup-results"
      >
        <div className="flex items-center gap-4">
          <Portrait brawler={b} size="lg" />
          <div>
            <h2 className="text-2xl font-bold">{displayBrawlerName(b, locale)}</h2>
          </div>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {[
          { t: "Vence (counters favoráveis)", list: rows.filter((x) => x.r.score > 0) },
          {
            t: "Perde (matchups desfavoráveis)",
            list: rows.filter((x) => x.r.score < 0).reverse(),
          },
        ].map((g) => (
          <section key={g.t} className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 font-bold">{g.t}</h3>
            {!g.list.length && (
              <p className="text-sm text-muted-foreground">Sem dados registrados.</p>
            )}
            <ul className="space-y-2">
              {g.list.map(({ o, r }) => (
                <li key={o.id} className="flex items-start gap-3 text-sm">
                  <MatchupChip score={r.score} />
                  <div>
                    <span className="font-semibold">{displayBrawlerName(o, locale)}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      ({r.scope}
                      {r.inverted ? ", inverso" : ""})
                    </span>
                    <p className="text-muted-foreground">{r.entry?.explanation}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Brawlers sem registro são tratados como neutros (0) e não aparecem aqui.
      </p>
      <DemoNotice />
    </div>
  );
}
