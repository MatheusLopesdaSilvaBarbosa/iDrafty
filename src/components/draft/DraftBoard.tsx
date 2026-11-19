import { useState } from "react";
import { Plus } from "lucide-react";
import { useDraft } from "@/lib/draft/store";
import { cn } from "@/lib/utils";
import { BrawlerPicker } from "./BrawlerPicker";
import { Portrait } from "./ui-bits";
import { MapImage } from "./MapImage";
import { getGuideBadges } from "@/data/strategy-guide";
import { getNextPickTeam, getPickOrder } from "@/lib/draft/store";

type Team = "allies" | "enemies";

export function MapModeBar({ readOnly = false }: { readOnly?: boolean }) {
  const { ds, draft, setMode, setMap, disabledMapIds } = useDraft();
  const maps = draft.mode
    ? ds.maps.filter((map) => map.mode === draft.mode && !disabledMapIds.includes(map.id))
    : [];
  const selectedMap = ds.maps.find((m) => m.id === draft.mapId);
  const selectedMode = ds.modes.find((mode) => mode.id === draft.mode);
  if (readOnly) {
    return (
      <section className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        {selectedMode?.imageUrl && (
          <img src={selectedMode.imageUrl} alt="" className="size-8 shrink-0 object-contain sm:size-10" />
        )}
        {selectedMap && <MapImage name={selectedMap.name} className="w-16 shrink-0 sm:w-24" />}
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Modo e mapa da partida
          </h2>
          <p className="mt-1 truncate text-sm font-bold">
            {selectedMode?.name ?? "Modo não selecionado"}
            {selectedMap ? ` · ${selectedMap.name}` : ""}
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4" data-tutorial="draft-mode-map">
      <section className="space-y-2" aria-labelledby="mode-selection-title">
        <div>
          <h2
            id="mode-selection-title"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            1. Escolha o modo
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ds.modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={draft.mode === mode.id}
              onClick={() => setMode(mode.id)}
              className={cn(
                "flex min-h-16 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                draft.mode === mode.id
                  ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/50"
                  : "border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {mode.imageUrl && (
                <img
                  src={mode.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-10 shrink-0 object-contain"
                />
              )}
              <span>{mode.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="map-selection-title">
        <div>
          <h2
            id="map-selection-title"
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            2. Escolha o mapa
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {draft.mode
              ? "Os mapas disponíveis para o modo escolhido aparecem abaixo."
              : "Escolha um modo para ver os mapas disponíveis."}
          </p>
        </div>
        {draft.mode && maps.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {maps.map((map) => (
              <button
                key={map.id}
                type="button"
                aria-pressed={draft.mapId === map.id}
                onClick={() => setMap(map.id)}
                className={cn(
                  "overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  draft.mapId === map.id
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-border hover:border-primary/50",
                )}
              >
                <MapImage name={map.name} className="aspect-video w-full rounded-none border-0" />
                <span
                  className={cn(
                    "block px-2.5 py-2 text-sm font-semibold",
                    draft.mapId === map.id ? "bg-primary/10 text-primary" : "bg-surface",
                  )}
                >
                  {map.name}
                </span>
              </button>
            ))}
          </div>
        )}
        {draft.mode && maps.length === 0 && (
          <p className="rounded-lg bg-surface p-4 text-sm text-muted-foreground">
            Todos os mapas deste modo estão desativados na rotação.
          </p>
        )}
      </section>

      {selectedMap && (
        <p className="text-xs text-muted-foreground">
          Selecionado: <span className="font-semibold text-foreground">{selectedMap.name}</span>
        </p>
      )}
    </div>
  );
}

export function TeamPanel({ team }: { team: Team }) {
  const { ds, draft, setSlot } = useDraft();
  const [slot, setSlotOpen] = useState<number | null>(null);
  const ally = team === "allies";
  const activeTeam = getNextPickTeam(draft);
  const isTurn = draft.started && activeTeam === team;
  const nextSlot = draft[team].findIndex((id) => id === null);
  const teamPickNumbers = getPickOrder(draft.coin).flatMap((pickTeam, index) =>
    pickTeam === team ? [index + 1] : [],
  );
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4 transition-all",
        ally ? "border-ally/40" : "border-enemy/40",
        isTurn &&
          (ally
            ? "ring-2 ring-ally/70 shadow-lg shadow-ally/10"
            : "ring-2 ring-enemy/70 shadow-lg shadow-enemy/10"),
      )}
    >
      <h2
        className={cn(
          "mb-3 flex items-center justify-between gap-2 text-sm font-bold uppercase tracking-[0.2em]",
          ally ? "text-ally" : "text-enemy",
        )}
      >
        <span>{ally ? "Minha equipe" : "Equipe adversária"}</span>
        {isTurn && (
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] tracking-normal text-primary">
            SUA VEZ
          </span>
        )}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {draft[team].map((id, i) => {
          const b = id ? ds.brawlers.find((x) => x.id === id) : null;
          const pickNumber = teamPickNumbers[i] ?? i + 1;
          return (
            <div key={i} className="relative">
              <button
                data-tutorial={isTurn && !b && i === nextSlot ? "draft-pick-slot" : undefined}
                onClick={() => {
                  if (isTurn && !b && i === nextSlot) setSlotOpen(i);
                }}
                disabled={!isTurn || !!b || i !== nextSlot}
                className={cn(
                  "relative flex min-h-32 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border-2 border-dashed px-1 py-2 transition disabled:cursor-not-allowed sm:min-h-40 sm:gap-2",
                  b
                    ? "border-transparent bg-surface"
                    : isTurn && i === nextSlot
                      ? "border-primary/70 bg-primary/5 hover:border-primary"
                      : "border-border opacity-60",
                )}
                aria-label={
                  b ? `${b.name}, posição ${pickNumber}` : `Escolher posição ${pickNumber}`
                }
              >
                {b ? (
                  <>
                    <Portrait brawler={b} size="lg" className="size-12 sm:size-16 lg:size-20" />
                    <span className="line-clamp-2 break-words text-center text-xs font-bold sm:text-sm">{b.name}</span>
                    <span className="relative flex min-h-5 w-full max-w-full flex-wrap justify-center gap-1">
                      {getGuideBadges(b.id, b.role, b.range, b).map((badge) => (
                        <span
                          key={badge}
                          className={cn(
                            "rounded px-1 py-0.5 text-[8px] font-bold",
                            badge.startsWith("⚠")
                              ? "bg-red-500/10 text-red-400"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {badge}
                        </span>
                      ))}
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 right-0 text-xs font-bold tabular-nums text-muted-foreground"
                      >
                        {pickNumber}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <Plus className="size-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {isTurn && i === nextSlot ? "Sua vez — escolher" : "Escolher"}
                    </span>
                  </>
                )}
                {!b && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2 right-2 text-xs font-bold tabular-nums text-muted-foreground"
                  >
                    {pickNumber}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      <BrawlerPicker
        open={slot !== null}
        onOpenChange={(o) => !o && setSlotOpen(null)}
        current={slot !== null ? draft[team][slot] : null}
        title={`${ally ? "Aliado" : "Adversário"} — pick ${slot !== null ? slot + 1 : ""}`}
        onPick={(id) => {
          if (slot !== null && isTurn && slot === nextSlot) setSlot(team, slot, id);
          setSlotOpen(null);
        }}
      />
    </section>
  );
}
