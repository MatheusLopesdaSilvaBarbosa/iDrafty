import type { CandidateResult } from "@/lib/draft/engine";
import { Ban } from "lucide-react";
import { useDraft } from "@/lib/draft/store";
import { displayBrawlerName, displayRole, useLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MatchupChip, Portrait, ScoreRing } from "./ui-bits";
import { getAvailableHardCounters, getGuideBadges } from "@/data/strategy-guide";
import { getSynergy } from "@/lib/draft/engine";
import type { Brawler } from "@/lib/draft/types";

export function CandidateCard({
  c,
  rank,
  onPick,
  onBan,
  compact,
  team = "allies",
  showWarning = true,
  showAvailableHardCounters = false,
  showMatchupCoverage = true,
  tutorialPick = false,
}: {
  c: CandidateResult;
  rank: number;
  onPick?: () => void;
  onBan?: () => void;
  compact?: boolean;
  team?: "allies" | "enemies";
  showWarning?: boolean;
  showAvailableHardCounters?: boolean;
  showMatchupCoverage?: boolean;
  tutorialPick?: boolean;
}) {
  const { locale } = useLocale();
  const { ds, draft, bannedBrawlers } = useDraft();
  const b = ds.brawlers.find((x) => x.id === c.id)!;
  const name = (id: string) => {
    const brawler = ds.brawlers.find((x) => x.id === id)!;
    return displayBrawlerName(brawler, locale);
  };
  const unavailableIds = new Set([
    ...bannedBrawlers,
    ...draft.allies.filter((id): id is string => !!id),
    ...draft.enemies.filter((id): id is string => !!id),
  ]);
  const availableHardCounters = showAvailableHardCounters
    ? getAvailableHardCounters(c.id, unavailableIds)
        .map((id) => ds.brawlers.find((brawler) => brawler.id === id))
        .filter((brawler): brawler is Brawler => !!brawler && brawler.available !== false)
    : [];
  const pickedAllies = draft[team].filter(
    (allyId): allyId is string => !!allyId && allyId !== c.id,
  );
  const teamSynergies = pickedAllies.filter((allyId) => getSynergy(ds, c.id, allyId).score > 0);
  const risks = c.risks.filter(
    (risk) =>
      !risk.startsWith("Sem dados de matchup contra") && (showWarning || risk !== c.warning),
  );
  const componentKeys = showMatchupCoverage
    ? (["matchup", "synergy", "fit", "coverage"] as const)
    : (["matchup", "synergy", "fit"] as const);
  return (
    <article
      className={cn(
        "flex h-full flex-col animate-in fade-in slide-in-from-bottom-1 rounded-xl border bg-card p-4",
        rank === 1 ? "border-primary/70 glow-primary" : "border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "font-display text-2xl font-bold",
            rank === 1 ? "text-primary" : "text-muted-foreground",
          )}
        >
          #{rank}
        </span>
        <Portrait brawler={b} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{displayBrawlerName(b, locale)}</h3>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {displayRole(b.role, locale)}
            {getGuideBadges(b.id, b.role, b.range, b)
              .filter((badge) => showWarning || !badge.startsWith("⚠ LAST PICK"))
              .map((badge) => (
                <span
                  key={badge}
                  className={
                    badge.startsWith("⚠")
                      ? "rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-400"
                      : "rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                  }
                >
                  {badge}
                </span>
              ))}
          </div>
          {showMatchupCoverage && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {c.matchups.length
                ? `Cobertura de matchups: ${Math.round(c.matchupCoverage * 100)}%`
                : "Cobertura de matchups: selecione adversários"}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-1">
          <ScoreRing value={c.score} />
          {onBan && (
            <button
              type="button"
              onClick={onBan}
              aria-label={(locale === "en" ? "Ban " : "Banir ") + displayBrawlerName(b, locale)}
              title={
                (locale === "en" ? "Mark " : "Marcar ") +
                displayBrawlerName(b, locale) +
                (locale === "en" ? " as banned" : " como banido")
              }
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-bad transition hover:bg-bad/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Ban className="size-3.5" />
              {locale === "en" ? "Ban" : "Banir"}
            </button>
          )}
        </div>
      </div>
      {teamSynergies.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {teamSynergies.map((allyId) => (
            <span
              key={allyId}
              className="rounded-md bg-good/10 px-2 py-1 text-xs font-semibold text-good"
            >
              + {name(allyId)}
            </span>
          ))}
        </div>
      )}
      {c.matchups.length > 0 && (
        <div className={cn("flex flex-wrap gap-2", teamSynergies.length ? "mt-2" : "mt-3")}>
          {c.matchups.map((m) => (
            <div
              key={m.enemyId}
              className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-xs"
            >
              <span className="text-muted-foreground">vs {name(m.enemyId)}</span>
              <MatchupChip score={m.score} known={m.known} />
            </div>
          ))}
        </div>
      )}
      {showWarning && c.warning && (
        <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          <p>⚠ {c.warning}</p>
          {showAvailableHardCounters && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-red-500/20 pt-2">
              <span className="font-semibold">Hard counters ainda disponíveis:</span>
              {availableHardCounters.length > 0 ? (
                availableHardCounters.map((counter) => (
                  <span
                    key={counter.id}
                    className="inline-flex items-center gap-1.5 rounded-md bg-red-500/10 pr-2"
                  >
                    <Portrait brawler={counter} size="sm" />
                    <span>{displayBrawlerName(counter, locale)}</span>
                  </span>
                ))
              ) : (
                <span>Nenhum — já foram escolhidos ou banidos.</span>
              )}
            </div>
          )}
        </div>
      )}
      {!compact && (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            {componentKeys.map((k) => (
              <div key={k}>
                <dt className="text-muted-foreground">
                  {
                    {
                      matchup: "Matchup",
                      synergy: "Sinergia",
                      fit: "Modo + mapa",
                      coverage: "Cobertura",
                    }[k]
                  }
                </dt>
                <dd className="font-display font-bold">{Math.round(c.components[k] * 100)}</dd>
              </div>
            ))}
          </dl>
          {c.penalty > 0 && (
            <p className="mt-2 text-xs text-bad">
              Penalidade de risco aplicada (pior matchup {c.worst}).
            </p>
          )}
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <ul className="space-y-1">
              {c.positives.slice(0, 4).map((p) => (
                <li key={p} className="text-good">
                  + <span className="text-foreground/90">{p}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-1">
              {risks.slice(0, 4).map((p) => (
                <li key={p} className="text-bad">
                  − <span className="text-foreground/90">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {onPick && (
        <div className="mt-auto pt-4">
          <button
            onClick={onPick}
            data-tutorial={tutorialPick ? "draft-suggested-pick" : undefined}
            className="w-full rounded-md border border-primary/50 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            {locale === "en" ? "Choose" : "Escolher"} {displayBrawlerName(b, locale)}
          </button>
        </div>
      )}
    </article>
  );
}
