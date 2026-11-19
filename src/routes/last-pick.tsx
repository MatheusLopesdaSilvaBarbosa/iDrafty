import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CandidateCard } from "@/components/draft/CandidateCard";
import { PageTutorial } from "@/components/draft/PageTutorial";
import { DemoNotice, MatchupChip } from "@/components/draft/ui-bits";
import { draftLimitations, explainLeader, rankCandidates } from "@/lib/draft/engine";
import { useDraft } from "@/lib/draft/store";

export const Route = createFileRoute("/last-pick")({
  head: () => ({
    meta: [
      { title: "Last Pick — IDrafty" },
      { name: "description", content: "Ranking dos melhores last picks contra os três adversários, com justificativas." },
      { property: "og:title", content: "Last Pick — IDrafty" },
      { property: "og:description", content: "Ranking dos melhores last picks contra os três adversários, com justificativas." },
    ],
  }),
  component: LastPick,
});

function LastPick() {
  const { ds, draft, bannedBrawlers, setSlot, toggleBan } = useDraft();
  const [tutorialPicked, setTutorialPicked] = useState(false);
  const enemies = draft.enemies.filter((x): x is string => !!x);
  // The last ally slot is the one being decided; if all filled, re-evaluate slot 3.
  const emptySlot = draft.allies.findIndex((x) => !x);
  const slot = emptySlot >= 0 ? emptySlot : 2;
  const ranked = useMemo(
    () => rankCandidates(ds, draft, { limit: 5, allySlot: slot, excludeIds: bannedBrawlers }),
    [ds, draft, slot, bannedBrawlers],
  );
  const why = explainLeader(ds, ranked);
  const limits = draftLimitations(ds, draft, ranked);
  const name = (id: string) => ds.brawlers.find((b) => b.id === id)!.name;
  const synLabel = (v: number) => (v >= 0.66 ? "Alta" : v > 0.5 ? "Média" : v === 0.5 ? "—" : "Baixa");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Last Pick</h1>
        <p className="text-sm text-muted-foreground">Avaliação conjunta contra os adversários, com penalidade para matchups muito desfavoráveis.</p>
      </div>
      <PageTutorial
        pageId="last-pick"
        title="Last Pick"
        steps={[
          { title: "Registre os adversários", description: "Preencha os picks inimigos na página Draft. O ranking usa esses confrontos para avaliar candidatos.", target: "[data-tutorial='last-pick-draft-link']", completed: enemies.length > 0 },
          { title: "Compare as opções", description: "Veja a nota geral, cada matchup e a sinergia com sua equipe para entender o que pesa no ranking.", target: "[data-tutorial='last-pick-ranking']" },
          { title: "Escolha um candidato", description: "Leia os riscos e counters ainda disponíveis. Selecionar um brawler atualiza seu próximo pick no Draft.", target: "[data-tutorial='last-pick-candidates']", completed: tutorialPicked },
        ]}
      />
      {enemies.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-muted-foreground">Registre os adversários no draft para ver o ranking.</p>
          <Link to="/draft" className="mt-3 inline-block font-semibold text-primary" data-tutorial="last-pick-draft-link">Ir para o draft →</Link>
        </div>
      ) : (
        <>
          {limits.map((l) => <p key={l.text} className={l.level === "aviso" ? "text-sm text-primary" : "text-sm text-muted-foreground"}>• {l.text}</p>)}
          <div className="overflow-x-auto rounded-xl border border-border bg-card" data-tutorial="last-pick-ranking">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-3 text-left">Candidato</th>
                  {enemies.map((e) => <th key={e} className="p-3">{name(e)}</th>)}
                  <th className="p-3">Sinergia</th><th className="p-3">Nota</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((c, i) => (
                  <tr key={c.id} className={i === 0 ? "bg-primary/10" : "border-t border-border"}>
                    <td className="p-3 font-bold">{i + 1}. {name(c.id)}</td>
                    {c.matchups.map((m) => <td key={m.enemyId} className="p-3 text-center"><MatchupChip score={m.score} known={m.known} /></td>)}
                    <td className="p-3 text-center">{synLabel(c.components.synergy)}</td>
                    <td className="p-3 text-center font-display text-lg font-bold">{c.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {why && <p className="rounded-lg border-l-4 border-primary bg-card p-3 text-sm"><strong>Por que o #1?</strong> {why}</p>}
          <div className="grid gap-3 md:grid-cols-2" data-tutorial="last-pick-candidates">
            {ranked.map((c, i) => (
              <CandidateCard
                key={c.id}
                c={c}
                rank={i + 1}
                onPick={() => {
                  setSlot("allies", slot, c.id);
                  setTutorialPicked(true);
                }}
                onBan={() => toggleBan(c.id)}
                showAvailableHardCounters
                showMatchupCoverage={false}
              />
            ))}
          </div>
        </>
      )}
      <DemoNotice />
    </div>
  );
}
