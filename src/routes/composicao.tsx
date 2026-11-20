import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { TeamPanel } from "@/components/draft/DraftBoard";
import { PageTutorial } from "@/components/draft/PageTutorial";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { DemoNotice, MatchupChip, Portrait, ScoreRing } from "@/components/draft/ui-bits";
import { analyzeComposition, scoreCandidate } from "@/lib/draft/engine";
import { useDraft } from "@/lib/draft/store";
import { displayBrawlerName, useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/composicao")({
  head: () => ({
    meta: [
      { title: "Composição — IDrafty" },
      {
        name: "description",
        content: "Análise de sinergia, cobertura e vulnerabilidades da sua equipe.",
      },
      { property: "og:title", content: "Composição — IDrafty" },
      {
        property: "og:description",
        content: "Análise de sinergia, cobertura e vulnerabilidades da sua equipe.",
      },
    ],
  }),
  component: Composition,
});

const LABEL = {
  matchup: "Matchups",
  synergy: "Sinergia",
  fit: "Modo + mapa",
  coverage: "Cobertura",
  risk: "Vulnerabilidades (maior = menos)",
} as const;

const hideCompositionCardNotes = (items: string[]) =>
  items.filter(
    (item) =>
      !item.startsWith("Sem dados de matchup contra") &&
      !item.startsWith("ATENÇÃO:") &&
      !item.startsWith("Possível last pick:"),
  );

const hideCompositionHoverPositives = (items: string[]) =>
  items.filter(
    (item) =>
      !item.startsWith("Terreno favorável") &&
      !item.startsWith("Vantagem forte contra") &&
      !item.startsWith("Sinergia com "),
  );

const hideCompositionHoverRisks = (items: string[]) =>
  hideCompositionCardNotes(items).filter(
    (item) =>
      !item.startsWith("Desvantagem forte contra") &&
      !item.startsWith("Acumula fraqueza") &&
      !item.startsWith("Acumula fraquezas"),
  );

function Composition() {
  const { locale } = useLocale();
  const { ds, draft } = useDraft();
  const hasAllies = draft.allies.some(Boolean);
  const compositionScores = useMemo(
    () => ({
      allies: analyzeComposition(ds, draft),
      enemies: analyzeComposition(ds, {
        ...draft,
        allies: draft.enemies,
        enemies: draft.allies,
      }),
    }),
    [ds, draft],
  );
  const individualScores = useMemo(() => {
    const calculateTeamScores = (team: (string | null)[], opponents: (string | null)[]) => {
      const teamDraft = { ...draft, allies: team, enemies: opponents };
      return team.flatMap((id) => {
        if (!id) return [];
        const brawler = ds.brawlers.find((b) => b.id === id);
        if (!brawler) return [];
        return [
          {
            brawler,
            result: scoreCandidate(ds, id, teamDraft, undefined, undefined, false),
          },
        ];
      });
    };

    return {
      allies: calculateTeamScores(draft.allies, draft.enemies),
      enemies: calculateTeamScores(draft.enemies, draft.allies),
    };
  }, [ds, draft]);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Composição</h1>
      <PageTutorial
        pageId="composicao"
        title="Composição"
        steps={[
          {
            title: "Monte sua equipe",
            description:
              "Preencha seus picks na página Draft. Quando houver aliados registrados, o tour segue para a análise.",
            target: "[data-tutorial-nav='draft']",
            completed: hasAllies,
          },
          {
            title: "Revise as notas individuais",
            description:
              "Abra uma nota para ver os matchups e fatores considerados para cada brawler.",
            target: "[data-tutorial='composition-notes']",
          },
          {
            title: "Compare as equipes",
            description:
              "Confira o panorama das duas composições. A pontuação é uma estimativa estratégica, não chance de vitória.",
            target: "[data-tutorial='composition-comparison']",
          },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TeamPanel team="allies" />
        <TeamPanel team="enemies" />
      </div>
      <section
        className="space-y-3 rounded-xl border border-border bg-card p-4"
        data-tutorial="composition-notes"
      >
        <div>
          <h2 className="text-xl font-bold">Notas individuais</h2>
          <p className="text-xs text-muted-foreground">
            Cada nota considera o brawler contra a composição adversária, além do modo, mapa e
            sinergia com seus próprios aliados.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            [
              { key: "allies", title: "Minha equipe", tone: "text-ally" },
              { key: "enemies", title: "Equipe adversária", tone: "text-enemy" },
            ] as const
          ).map(({ key, title, tone }) => (
            <div key={key} className="space-y-2">
              <h3 className={`font-bold ${tone}`}>{title}</h3>
              {individualScores[key].length ? (
                individualScores[key].map(({ brawler, result }) => (
                  <HoverCard key={brawler.id} openDelay={250} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${locale === "en" ? "View rating details for" : "Ver detalhes da nota de"} ${displayBrawlerName(brawler, locale)}`}
                        className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-2 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Portrait brawler={brawler} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {displayBrawlerName(brawler, locale)}
                        </span>
                        <span className="text-xs text-muted-foreground">Nota</span>
                        <ScoreRing value={result.score} />
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      align="start"
                      className="w-[min(42rem,calc(100vw-2rem))] space-y-3"
                    >
                      <div className="flex items-center gap-3 border-b border-border pb-3">
                        <Portrait brawler={brawler} size="sm" />
                        <h4 className="min-w-0 flex-1 truncate font-bold">
                          {displayBrawlerName(brawler, locale)}
                        </h4>
                        <ScoreRing value={result.score} />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-3 sm:pr-3">
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                            {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((component) => (
                              <div key={component} className="flex justify-between gap-2 text-xs">
                                <span className="text-muted-foreground">{LABEL[component]}</span>
                                <span className="font-bold tabular-nums">
                                  {Math.round(result.components[component] * 100)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1 border-t border-border pt-2">
                            <h5 className="text-xs font-bold">Matchups contra a outra equipe</h5>
                            {result.matchups.length ? (
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                {result.matchups.map((matchup) => {
                                  const opponent = ds.brawlers.find(
                                    (candidate) => candidate.id === matchup.enemyId,
                                  );
                                  return (
                                    <span
                                      key={matchup.enemyId}
                                      className="inline-flex min-w-0 items-center justify-between gap-1 text-[11px]"
                                    >
                                      <span className="truncate">
                                        {opponent
                                          ? displayBrawlerName(opponent, locale)
                                          : matchup.enemyId}
                                      </span>
                                      <MatchupChip score={matchup.score} known={matchup.known} />
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Nenhum adversário selecionado.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="space-y-3 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                          <div className="space-y-1">
                            <h5 className="text-xs font-bold text-good">Pontos fortes</h5>
                            {hideCompositionHoverPositives(result.positives).length ? (
                              <ul className="space-y-1 text-xs">
                                {hideCompositionHoverPositives(result.positives).map((item) => (
                                  <li key={item}>+ {item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Nenhum destaque identificado.
                              </p>
                            )}
                          </div>
                          {hideCompositionHoverRisks(result.risks).length > 0 && (
                            <div className="space-y-1 border-t border-border pt-2">
                              <h5 className="text-xs font-bold text-bad">Riscos</h5>
                              <ul className="space-y-1 text-xs">
                                {hideCompositionHoverRisks(result.risks).map((item) => (
                                  <li key={item}>− {item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum brawler selecionado.</p>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Notas estratégicas de 0 a 100; não representam chance de vitória.
        </p>
      </section>
      {!compositionScores.allies ? (
        <p className="text-muted-foreground">Escolha ao menos um aliado para analisar.</p>
      ) : (
        <section
          className="space-y-4 rounded-xl border border-border bg-card p-4"
          data-tutorial="composition-comparison"
        >
          <div>
            <h2 className="text-xl font-bold">Comparativo das composições</h2>
            <p className="text-xs text-muted-foreground">
              Azul é sempre sua equipe; vermelho é a equipe adversária. Notas estratégicas, não
              chances de vitória.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                {
                  title: "Sua equipe",
                  result: compositionScores.allies,
                  tone: "text-ally",
                  bar: "bg-ally",
                  border: "border-ally/40",
                },
                {
                  title: "Equipe adversária",
                  result: compositionScores.enemies,
                  tone: "text-enemy",
                  bar: "bg-enemy",
                  border: "border-enemy/40",
                },
              ] as const
            ).map(({ title, result, tone, bar, border }) => (
              <div key={title} className={`space-y-3 rounded-lg border ${border} bg-surface p-3`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`font-bold ${tone}`}>{title}</h3>
                  {result ? (
                    <span className={`font-display text-2xl font-bold tabular-nums ${tone}`}>
                      {result.score}
                      <span className="text-sm">/100</span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Aguardando picks</span>
                  )}
                </div>
                <div className="space-y-2">
                  {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((component) => {
                    const value = result?.components[component] ?? 0;
                    return (
                      <div key={component} className="text-sm">
                        <div className="flex justify-between gap-2">
                          <span>{LABEL[component]}</span>
                          <span className={`font-display font-bold ${tone}`}>
                            {result ? Math.round(value * 100) : "—"}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted">
                          {result && (
                            <div
                              className={`h-full rounded-full transition-all ${bar}`}
                              style={{ width: `${value * 100}%` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {result && (
                  <div className="space-y-2 border-t border-border pt-2">
                    <div>
                      <h4 className="text-xs font-bold text-good">Pontos fortes</h4>
                      {result.positives.length ? (
                        <ul className="space-y-1 text-xs">
                          {result.positives.map((item) => (
                            <li key={item}>+ {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nenhum destaque identificado.
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-bad">Problemas</h4>
                      {hideCompositionCardNotes(result.issues).length ? (
                        <ul className="space-y-1 text-xs">
                          {hideCompositionCardNotes(result.issues).map((item) => (
                            <li key={item}>− {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nenhum problema identificado.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <DemoNotice />
    </div>
  );
}
