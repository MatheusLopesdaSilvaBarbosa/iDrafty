import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCcw,
  Target,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MapModeBar, TeamPanel } from "@/components/draft/DraftBoard";
import { CandidateCard } from "@/components/draft/CandidateCard";
import { PageTutorial } from "@/components/draft/PageTutorial";
import { DemoNotice, Portrait, ScoreRing } from "@/components/draft/ui-bits";
import {
  analyzeComposition,
  draftLimitations,
  getMapBestBrawlerIds,
  PATHS,
  rankCandidates,
} from "@/lib/draft/engine";
import { getNextPickTeam } from "@/lib/draft/store";
import { useDraft } from "@/lib/draft/store";
import { cn } from "@/lib/utils";
import { displayBrawlerName, t, useLocale } from "@/lib/i18n";

export const Route = createFileRoute("/draft")({
  head: () => ({
    meta: [
      { title: "Draft — IDrafty" },
      {
        name: "description",
        content: "Monte o draft do Ranqueado e receba recomendações de pick em tempo real.",
      },
      { property: "og:title", content: "Draft — IDrafty" },
      {
        property: "og:description",
        content: "Monte o draft do Ranqueado e receba recomendações de pick em tempo real.",
      },
    ],
  }),
  component: DraftPage,
});

function DraftPage() {
  const { locale } = useLocale();
  const {
    ds,
    draft,
    bannedBrawlers,
    reset,
    beginFlow,
    continueToCoin,
    setSlot,
    startDraft,
    toggleBan,
    undoPick,
  } = useDraft();
  const [showBanSuggestions, setShowBanSuggestions] = useState(false);
  const [showLaterRecommendations, setShowLaterRecommendations] = useState(false);
  useEffect(() => {
    if (!showBanSuggestions) return;
    const timeout = window.setTimeout(() => setShowBanSuggestions(false), 10000);
    return () => window.clearTimeout(timeout);
  }, [showBanSuggestions]);
  useEffect(() => {
    setShowLaterRecommendations(false);
  }, [draft, bannedBrawlers]);
  const activeTeam = getNextPickTeam(draft);
  const completedPicks = [...draft.allies, ...draft.enemies].filter(Boolean).length;
  const slot = draft.allies.findIndex((x) => !x);
  const opponentSlot = draft.enemies.findIndex((x) => !x);
  const draftComplete = draft.started === true && completedPicks === 6;
  const composition = useMemo(() => analyzeComposition(ds, draft), [ds, draft]);
  const ranked = useMemo(
    () => rankCandidates(ds, draft, { limit: 5, excludeIds: bannedBrawlers }),
    [ds, draft, bannedBrawlers],
  );
  const opponentDraft = useMemo(
    () => ({ ...draft, allies: draft.enemies, enemies: draft.allies }),
    [draft],
  );
  const opponentRanked = useMemo(
    () => rankCandidates(ds, opponentDraft, { limit: 5, excludeIds: bannedBrawlers }),
    [ds, opponentDraft, bannedBrawlers],
  );
  const limits = draftLimitations(ds, draft, ranked);
  const visibleLimits = limits.filter(
    ({ text }) => !text.startsWith("Apenas ") && !text.startsWith("Confiança baixa:"),
  );
  const paths = useMemo(
    () =>
      PATHS.map((p) => ({
        p,
        top: rankCandidates(ds, draft, {
          weights: p.weights,
          limit: 1,
          excludeIds: bannedBrawlers,
        })[0],
      })),
    [ds, draft, bannedBrawlers],
  );
  const banSuggestions = useMemo(
    () => {
      const bestBrawlerIds = new Set(getMapBestBrawlerIds(ds, draft.mapId));
      return ds.brawlers.filter(
        (brawler) => brawler.available !== false && bestBrawlerIds.has(brawler.id),
      );
    },
    [ds, draft.mapId],
  );
  const name = (id: string) => ds.brawlers.find((b) => b.id === id)!;
  const selectCoin = (coin: "blue" | "red") => {
    startDraft(coin);
    setShowBanSuggestions(true);
  };
  const resetDraft = () => {
    setShowBanSuggestions(false);
    reset();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Draft</h1>
          <p className="text-sm text-muted-foreground">
            Escolha mapa, modo e brawlers. A análise atualiza sozinha.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetDraft}
          className="self-start sm:self-auto"
        >
          <RotateCcw className="size-4" />
          Reiniciar Draft
        </Button>
      </div>
      <PageTutorial
        pageId="draft"
        revision="4"
        title="Draft"
        steps={[
          {
            title: "Comece o draft",
            description: "Toque em Começar para configurar a partida.",
            target: "[data-tutorial='draft-start']",
            completed: draft.stage !== "start",
          },
          {
            title: "Escolha modo e mapa",
            description:
              "Selecione o modo e o mapa. As recomendações levam esse contexto em conta.",
            target: "[data-tutorial='draft-mode-map']",
            completed: !!draft.mode && !!draft.mapId,
          },
          {
            title: "Avance para a ordem",
            description: "Com o mapa definido, toque em Escolher moeda para continuar.",
            target: "[data-tutorial='draft-continue-coin']",
            completed: draft.stage === "coin",
          },
          {
            title: "Escolha quem começa",
            description: "Escolha a moeda azul ou vermelha para definir a ordem dos seis picks.",
            target: "[data-tutorial='draft-coin-choice']",
            completed: draft.stage === "picks",
          },
          {
            title: "Sugestões de ban",
            description:
              "Estas opções vêm dos destaques do guia estratégico para o mapa escolhido. Banir é opcional; use-as para retirar ameaças fortes antes dos picks. A tela avança sozinha após alguns segundos.",
            target: "[data-tutorial='draft-ban-suggestions']",
            completed: !showBanSuggestions,
          },
          {
            title: "Entenda as sugestões",
            description:
              "A lista é recalculada a cada turno. O ranking considera o modo e o mapa, confrontos contra os brawlers já escolhidos, sinergia e cobertura da equipe. Avisos e justificativas do card ajudam a entender vantagens e riscos.",
            target: "[data-tutorial='draft-recommendations']",
          },
          {
            title: "Escolha uma sugest\u00e3o",
            description:
              "Use o bot\u00e3o do card para escolher um brawler ou monte o draft livremente pelos espa\u00e7os da equipe. O tour n\u00e3o escolhe por voc\u00ea.",
            target: "[data-tutorial='draft-suggested-pick']",
            advanceOnTargetClick: true,
            completed: completedPicks > 0,
          },
          {
            title:
              activeTeam === "enemies"
                ? "Poss\u00edveis pr\u00f3ximos picks do advers\u00e1rio"
                : "Continue o draft",
            description:
              activeTeam === "enemies"
                ? "O advers\u00e1rio recebe sugest\u00f5es pelo mesmo c\u00e1lculo usado para a sua equipe: considera modo e mapa, matchups, sinergia e cobertura, agora avaliando os brawlers para o lado advers\u00e1rio. Voc\u00ea continua livre para escolher qualquer brawler e finalizar o draft."
                : "Continue escolhendo brawlers para as duas equipes. Quando for a vez do advers\u00e1rio, as sugest\u00f5es usam o mesmo c\u00e1lculo do seu time. Voc\u00ea pode ignorar as sugest\u00f5es e finalizar como preferir.",
            target: "[data-tutorial='draft-recommendations']",
            completed: draftComplete,
            waitForCompletion: true,
          },
          ...(draftComplete
            ? [
                {
                  title: "An\u00e1lise de last pick",
                  description:
                    "Com o draft conclu\u00eddo, esta a\u00e7\u00e3o abre a an\u00e1lise dedicada ao pick final, considerando as equipes e o contexto da partida.",
                  target: "[data-tutorial='draft-last-pick']",
                  advanceOnTargetClick: true,
                },
                {
                  title: "Mais detalhes",
                  description:
                    "Abra a an\u00e1lise da composi\u00e7\u00e3o para consultar a nota estrat\u00e9gica e os detalhes que explicam os pontos fortes e as lacunas do seu time.",
                  target: "[data-tutorial='draft-more-details']",
                  finishOnTargetClick: true,
                },
              ]
            : []),
        ]}
      />
      {draft.stage === "start" && (
        <section className="animate-in fade-in slide-in-from-right-4 duration-500 motion-reduce:animate-none space-y-3 rounded-xl border border-primary/40 bg-card p-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Play className="size-7 fill-current" />
          </div>
          <h2 className="text-xl font-bold">Pronto para montar o draft?</h2>
          <p className="text-sm text-muted-foreground">
            Comece para escolher o modo e o mapa da partida.
          </p>
          <Button onClick={beginFlow} className="min-w-40" data-tutorial="draft-start">
            <Play className="size-4 fill-current" />
            Começar
          </Button>
        </section>
      )}
      {draft.stage === "map" && (
        <section className="animate-in fade-in slide-in-from-right-4 duration-500 motion-reduce:animate-none space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Etapa 1 de 3</p>
            <h2 className="text-xl font-bold">Escolha o modo e o mapa</h2>
          </div>
          <MapModeBar />
          <div className="flex justify-end">
            <Button
              onClick={continueToCoin}
              disabled={!draft.mode || !draft.mapId}
              data-tutorial="draft-continue-coin"
            >
              Escolher moeda <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      )}
      {draft.stage === "coin" && (
        <section className="animate-in fade-in slide-in-from-right-4 duration-500 motion-reduce:animate-none flex min-h-[65vh] flex-col items-center justify-center gap-8 py-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Etapa 2 de 3</p>
            <h2 className="mt-1 text-center text-2xl font-bold">Escolha quem começa</h2>
          </div>
          <div
            className="flex flex-wrap items-center justify-center gap-8 sm:gap-16"
            data-tutorial="draft-coin-choice"
          >
            <Button
              onClick={() => selectCoin("blue")}
              aria-label="Escolher moeda azul"
              className="size-32 overflow-hidden rounded-xl bg-sky-600 p-2 hover:bg-sky-700 min-[380px]:size-36 sm:size-44 sm:p-3 lg:size-56 lg:p-4"
            >
              <img src="/coin-blue.png" alt="" className="size-full scale-[1.12] object-contain" />
            </Button>
            <Button
              onClick={() => selectCoin("red")}
              aria-label="Escolher moeda vermelha"
              className="size-32 overflow-hidden rounded-xl bg-red-600 p-2 hover:bg-red-700 min-[380px]:size-36 sm:size-44 sm:p-3 lg:size-56 lg:p-4"
            >
              <img src="/coin-red.png" alt="" className="size-full object-contain" />
            </Button>
          </div>
        </section>
      )}
      {draft.stage === "picks" && showBanSuggestions && (
        <section
          aria-live="polite"
          data-tutorial="draft-ban-suggestions"
          className="animate-in fade-in slide-in-from-right-4 duration-500 motion-reduce:animate-none space-y-5 rounded-xl border border-primary/40 bg-card p-6 text-center sm:p-8"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {ds.maps.find((map) => map.id === draft.mapId)?.name}
            </p>
            <h2 className="mt-1 text-2xl font-bold">Sugestão de Bans</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione quem deseja banir. O draft começa automaticamente em 10 segundos.
            </p>
          </div>
          {banSuggestions.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {banSuggestions.map((brawler) => {
                const isBanned = bannedBrawlers.includes(brawler.id);
                return (
                  <Button
                    key={brawler.id}
                    variant="outline"
                    aria-pressed={isBanned}
                    onClick={() => toggleBan(brawler.id)}
                    className={cn(
                      "h-auto min-h-32 flex-col gap-2 p-4",
                      isBanned && "border-bad bg-bad/15 text-bad",
                    )}
                  >
                    <Portrait brawler={brawler} size="lg" />
                    <span className="font-bold">{displayBrawlerName(brawler, locale)}</span>
                    <span className="text-xs">{isBanned ? "Banido" : "Banir"}</span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-surface p-4 text-sm text-muted-foreground">
              O guia não tem brawlers destacados para este mapa.
            </p>
          )}
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="ban-suggestion-timer h-full w-full rounded-full bg-primary" />
          </div>
        </section>
      )}
      {draft.stage === "picks" && !showBanSuggestions && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500 motion-reduce:animate-none space-y-5">
          <section
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
              draftComplete
                ? "border-good/50 bg-good/5"
                : activeTeam === "allies"
                  ? "border-ally/60 bg-ally/5"
                  : "border-enemy/60 bg-enemy/5",
            )}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {draft.coin === "blue" ? "Moeda Azul" : "Moeda Vermelha"} ·{" "}
                {draftComplete
                  ? t("Draft finalizado", locale)
                  : locale === "en"
                    ? `Pick ${completedPicks + 1} of 6`
                    : `Pick ${completedPicks + 1} de 6`}
              </p>
              <h2
                className={cn(
                  "mt-1 text-xl font-bold",
                  draftComplete
                    ? "text-good"
                    : activeTeam === "allies"
                      ? "text-ally"
                      : "text-enemy",
                )}
              >
                {draftComplete ? (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="size-5" />
                    {t("Draft finalizado!", locale)}
                  </span>
                ) : activeTeam === "allies" ? (
                  "Sua Equipe escolhe agora"
                ) : (
                  "Equipe Adversária escolhe agora"
                )}
              </h2>
              <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
                {draft.coin === "blue"
                  ? "Azul: Sua Equipe → Adversária → Adversária → Sua Equipe → Sua Equipe → Adversária"
                  : "Vermelha: Adversária → Sua Equipe → Sua Equipe → Adversária → Adversária → Sua Equipe"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-2 text-xs font-bold">
                <span
                  className={cn(
                    "rounded-full px-3 py-2",
                    activeTeam === "allies" && !draftComplete
                      ? "bg-ally text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Sua Equipe
                </span>
                <span
                  className={cn(
                    "rounded-full px-3 py-2",
                    activeTeam === "enemies" && !draftComplete
                      ? "bg-enemy text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Adversária
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={undoPick}
                disabled={completedPicks === 0}
              >
                <Undo2 className="size-4" />
                Desfazer pick
              </Button>
            </div>
          </section>
          <MapModeBar readOnly />
          <div className="grid gap-4 md:grid-cols-2">
            <TeamPanel team="allies" />
            <TeamPanel team="enemies" />
          </div>

          {draft.enemies.every(Boolean) && (
            <Link
              to="/last-pick"
              data-tutorial="draft-last-pick"
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display font-bold text-primary-foreground glow-primary"
            >
              <Target className="size-5" />
              Ver análise de last pick
            </Link>
          )}

          {!draftComplete && activeTeam === "allies" && slot >= 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold">
                Próximo pick recomendado{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  (posição {slot + 1})
                </span>
              </h2>
              {visibleLimits.map((l) => (
                <p
                  key={l.text}
                  className={
                    l.level === "aviso" ? "text-sm text-primary" : "text-sm text-muted-foreground"
                  }
                >
                  • {l.text}
                </p>
              ))}
              <div
                data-tutorial="draft-recommendations"
                key={showLaterRecommendations ? "later-recommendations" : "top-recommendations"}
                className={cn(
                  "grid animate-in fade-in duration-500 motion-reduce:animate-none gap-3",
                  showLaterRecommendations
                    ? "slide-in-from-right-3 grid-cols-1 md:grid-cols-[5.5rem_repeat(3,minmax(0,1fr))]"
                    : "slide-in-from-left-3 grid-cols-1 md:grid-cols-[repeat(3,minmax(0,1fr))_5.5rem]",
                )}
              >
                {showLaterRecommendations && ranked.length > 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Voltar às três primeiras recomendações"
                    className="group flex min-h-16 w-full items-center justify-center rounded-xl border-sky-300/30 bg-sky-300/[0.06] p-3 text-sky-200 shadow-sm transition-all hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100 hover:shadow-md md:h-full md:min-h-[220px]"
                    onClick={() => setShowLaterRecommendations(false)}
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-sky-300/10 transition-colors group-hover:bg-sky-300/20">
                      <ChevronLeft className="size-6 transition-transform group-hover:-translate-x-0.5" />
                    </span>
                  </Button>
                )}
                {ranked
                  .slice(showLaterRecommendations ? 2 : 0, showLaterRecommendations ? 5 : 3)
                  .map((c, i) => (
                    <CandidateCard
                      key={c.id}
                      c={c}
                      rank={i + (showLaterRecommendations ? 3 : 1)}
                      compact
                      onPick={() => setSlot("allies", slot, c.id)}
                      onBan={() => toggleBan(c.id)}
                      showWarning={completedPicks !== 5}
                      showAvailableHardCounters
                      showMatchupCoverage={false}
                      tutorialPick={i === 0}
                    />
                  ))}
                {!showLaterRecommendations && ranked.length > 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Ver as recomendações de quarta e quinta posição"
                    className="group flex min-h-16 w-full items-center justify-center rounded-xl border-sky-300/30 bg-sky-300/[0.06] p-3 text-sky-200 shadow-sm transition-all hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100 hover:shadow-md md:h-full md:min-h-[220px]"
                    onClick={() => setShowLaterRecommendations(true)}
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-sky-300/10 transition-colors group-hover:bg-sky-300/20">
                      <ChevronRight className="size-6 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Button>
                )}
              </div>
              <h3 className="pt-2 text-lg font-bold">Caminhos de draft</h3>
              <div className="grid gap-3 md:grid-cols-3">
                {paths.map(
                  ({ p, top }) =>
                    top && (
                      <div
                        key={p.id}
                        className="flex h-full flex-col rounded-xl border border-border bg-card p-4"
                      >
                        <div className="text-sm font-bold text-primary">{p.title}</div>
                        <div className="mt-2 flex items-center gap-3">
                          <Portrait brawler={name(top.id)} size="sm" />
                          <span className="flex-1 font-bold">
                            {displayBrawlerName(name(top.id), locale)}
                          </span>
                          <ScoreRing value={top.score} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>
                        <p className="mt-1 text-xs text-bad">Risco: {p.risk}</p>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-auto w-full"
                          onClick={() => setSlot("allies", slot, top.id)}
                        >
                          {locale === "en" ? "Choose" : "Escolher"}{" "}
                          {displayBrawlerName(name(top.id), locale)}
                        </Button>
                      </div>
                    ),
                )}
              </div>
            </section>
          )}
          {!draftComplete && activeTeam === "enemies" && (
            <section className="space-y-3">
              <div>
                <h2 className="text-xl font-bold">Possíveis próximos picks do adversário</h2>
                <p className="text-sm text-muted-foreground">
                  Sugestões calculadas com base nos picks adversários, nos seus picks e no mapa.
                </p>
              </div>
              <div
                data-tutorial="draft-recommendations"
                key={
                  showLaterRecommendations
                    ? "opponent-later-recommendations"
                    : "opponent-top-recommendations"
                }
                className={cn(
                  "grid animate-in fade-in duration-500 motion-reduce:animate-none gap-3",
                  showLaterRecommendations
                    ? "slide-in-from-right-3 grid-cols-1 md:grid-cols-[5.5rem_repeat(3,minmax(0,1fr))]"
                    : "slide-in-from-left-3 grid-cols-1 md:grid-cols-[repeat(3,minmax(0,1fr))_5.5rem]",
                )}
              >
                {showLaterRecommendations && opponentRanked.length > 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Voltar às três primeiras sugestões para o adversário"
                    className="group flex min-h-16 w-full items-center justify-center rounded-xl border-sky-300/30 bg-sky-300/[0.06] p-3 text-sky-200 shadow-sm transition-all hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100 hover:shadow-md md:h-full md:min-h-[220px]"
                    onClick={() => setShowLaterRecommendations(false)}
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-sky-300/10 transition-colors group-hover:bg-sky-300/20">
                      <ChevronLeft className="size-6 transition-transform group-hover:-translate-x-0.5" />
                    </span>
                  </Button>
                )}
                {opponentRanked
                  .slice(showLaterRecommendations ? 2 : 0, showLaterRecommendations ? 5 : 3)
                  .map((candidate, index) => (
                    <CandidateCard
                      key={candidate.id}
                      c={candidate}
                      rank={index + (showLaterRecommendations ? 3 : 1)}
                      compact
                      team="enemies"
                      onPick={() => setSlot("enemies", opponentSlot, candidate.id)}
                      onBan={() => toggleBan(candidate.id)}
                      showWarning={completedPicks !== 5}
                      showAvailableHardCounters
                      showMatchupCoverage={false}
                      tutorialPick={index === 0}
                    />
                  ))}
                {!showLaterRecommendations && opponentRanked.length > 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Ver as sugestões de quarta e quinta posição para o adversário"
                    className="group flex min-h-16 w-full items-center justify-center rounded-xl border-sky-300/30 bg-sky-300/[0.06] p-3 text-sky-200 shadow-sm transition-all hover:border-sky-300/60 hover:bg-sky-300/10 hover:text-sky-100 hover:shadow-md md:h-full md:min-h-[220px]"
                    onClick={() => setShowLaterRecommendations(true)}
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-sky-300/10 transition-colors group-hover:bg-sky-300/20">
                      <ChevronRight className="size-6 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Button>
                )}
              </div>
            </section>
          )}
          {draftComplete && (
            <section className="flex flex-col gap-4 rounded-xl border border-good/40 bg-good/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <CheckCircle2 className="size-8 shrink-0 text-good" />
                <div>
                  <h2 className="font-bold">Draft concluído · Nota da composição</h2>
                  {composition ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Nota estratégica da sua equipe; não representa chance de vitória.
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        Composição: {composition.score}/100
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Não foi possível calcular a nota da composição.
                    </p>
                  )}
                </div>
              </div>
              <Link
                to="/composicao"
                data-tutorial="draft-more-details"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                Mais detalhes <ArrowRight className="size-4" />
              </Link>
            </section>
          )}
        </div>
      )}
      <DemoNotice />
    </div>
  );
}
