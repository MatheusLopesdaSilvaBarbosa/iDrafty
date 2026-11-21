import { useMemo, useState } from "react";
import { Ban, Info, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDraft } from "@/lib/draft/store";
import {
  displayBrawlerName,
  displayRarity,
  displayRole,
  displayRange,
  useLocale,
} from "@/lib/i18n";
import { picked } from "@/lib/draft/engine";
import type { Brawler, BrawlerRarity, Role } from "@/lib/draft/types";
import { BrawlerImageLink, Portrait } from "./ui-bits";
import {
  getDraftWarning,
  getGuideBadges,
  getGuideCounterTargets,
  getGuideEntry,
  getGuideHardCounterTargets,
  getMatchupGuideEntry,
} from "@/data/strategy-guide";

const ROLES: Role[] = [
  "Dano",
  "Tanque",
  "Atirador",
  "Assassino",
  "Suporte",
  "Controle",
  "Artilharia",
];
const RARITIES: BrawlerRarity[] = [
  "Inicial",
  "Raro",
  "Super-raro",
  "Épico",
  "Mítico",
  "Lendário",
  "Ultralendário",
  "Indisponível",
];
const RARITY_STYLES: Record<BrawlerRarity, string> = {
  Inicial: "border-zinc-500/50 text-zinc-300",
  Raro: "border-green-500/50 text-green-400",
  "Super-raro": "border-sky-500/50 text-sky-400",
  Épico: "border-violet-500/50 text-violet-400",
  Mítico: "border-pink-500/50 text-pink-400",
  Lendário: "border-amber-500/50 text-amber-400",
  Ultralendário: "rarity-ultra text-fuchsia-100",
  Indisponível: "border-muted text-muted-foreground",
};

export function BrawlerPicker({
  open,
  onOpenChange,
  onPick,
  current,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (id: string) => void;
  current?: string | null | undefined;
  title: string;
}) {
  const { ds, draft, bannedBrawlers } = useDraft();
  const { locale } = useLocale();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [rarity, setRarity] = useState<BrawlerRarity | null>(null);
  const [modeFitOnly, setModeFitOnly] = useState(false);
  const [mapFitOnly, setMapFitOnly] = useState(false);
  const [metaOnly, setMetaOnly] = useState(false);
  const [subMetaOnly, setSubMetaOnly] = useState(false);
  const [info, setInfo] = useState<Brawler | null>(null);
  const taken = new Set(picked(draft));
  const banned = new Set(bannedBrawlers);
  const map = ds.maps.find((m) => m.id === draft.mapId);
  const bestMapBrawlerIds = new Set(map?.goodBrawlers ?? []);
  const recommendedModeBrawlerIds = new Set(
    ds.modes.find((mode) => mode.id === draft.mode)?.recommendedBrawlers ?? [],
  );
  const brawlerName = (id: string) => {
    const brawler = ds.brawlers.find((b) => b.id === id);
    return brawler ? displayBrawlerName(brawler, locale) : id;
  };
  const mapName = (id: string) => ds.maps.find((m) => m.id === id)?.name ?? id;

  const list = useMemo(
    () =>
      ds.brawlers
        .filter((b) => {
          if (
            q &&
            ![b.name, b.imageAlias ?? ""].some((name) =>
              name.toLowerCase().includes(q.toLowerCase()),
            )
          )
            return false;
          if (role && b.role !== role) return false;
          if (rarity && b.rarity !== rarity) return false;
          if (metaOnly || subMetaOnly) {
            if (!((metaOnly && b.meta) || (subMetaOnly && b.subMeta))) return false;
          }
          const guide = getGuideEntry(b.id);
          if (modeFitOnly && (!draft.mode || !recommendedModeBrawlerIds.has(b.id))) return false;
          if (mapFitOnly && (!map || !bestMapBrawlerIds.has(b.id))) return false;
          return true;
        })
        .sort(
          (a, b) =>
            RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) ||
            displayBrawlerName(a, locale).localeCompare(displayBrawlerName(b, locale), locale),
        ),
    [
      ds.brawlers,
      q,
      role,
      rarity,
      modeFitOnly,
      mapFitOnly,
      metaOnly,
      subMetaOnly,
      draft.mode,
      map,
      ds.modes,
      locale,
    ],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setInfo(null);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Buscar brawler…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!role} onClick={() => setRole(null)}>
            Todos
          </Chip>
          {ROLES.map((r) => (
            <Chip key={r} active={role === r} onClick={() => setRole(role === r ? null : r)}>
              {r}
            </Chip>
          ))}
          <span className="w-full pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Raridade
          </span>
          <Chip active={!rarity} onClick={() => setRarity(null)}>
            Todas
          </Chip>
          {RARITIES.map((r) => (
            <Chip key={r} active={rarity === r} onClick={() => setRarity(rarity === r ? null : r)}>
              {r}
            </Chip>
          ))}
          <span className="w-full pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Tier estratégico
          </span>
          <Chip active={metaOnly} onClick={() => setMetaOnly(!metaOnly)}>
            🌟 META
          </Chip>
          <Chip active={subMetaOnly} onClick={() => setSubMetaOnly(!subMetaOnly)}>
            ✨ Sub-Meta
          </Chip>
          <Chip
            active={modeFitOnly}
            onClick={() => setModeFitOnly(!modeFitOnly)}
            disabled={!draft.mode}
          >
            Bom no modo
          </Chip>
          <Chip active={mapFitOnly} onClick={() => setMapFitOnly(!mapFitOnly)} disabled={!map}>
            Bom no mapa
          </Chip>
        </div>

        {info && (
          <div className="rounded-lg border border-border bg-surface p-3 text-sm">
            <div className="flex items-center gap-3">
              <Portrait brawler={info} />
              <div className="flex-1">
                <div className="font-display text-lg font-bold">
                  {displayBrawlerName(info, locale)}
                </div>
                <div className="text-muted-foreground">
                  {displayRole(info.role, locale)} · {locale === "en" ? "range" : "alcance"}{" "}
                  {displayRange(info.range, locale)}
                </div>
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                    RARITY_STYLES[info.rarity],
                  )}
                >
                  {displayRarity(info.rarity, locale)}
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {getGuideBadges(info.id, info.role, info.range, info).map((badge) => (
                    <span
                      key={badge}
                      className={
                        badge.startsWith("⚠")
                          ? "rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400"
                          : "rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary"
                      }
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <BrawlerImageLink brawler={info} />
                <Button
                  size="sm"
                  disabled={
                    banned.has(info.id) ||
                    (taken.has(info.id) && info.id !== current) ||
                    info.available === false
                  }
                  onClick={() => {
                    onPick(info.id);
                    setInfo(null);
                  }}
                >
                  {banned.has(info.id)
                    ? "Banido"
                    : info.available === false
                      ? "Indisponível"
                      : "Selecionar"}
                </Button>
              </div>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-good">Fortes:</span> {info.strengths.join("; ")}
              </div>
              <div>
                <span className="text-bad">Fracos:</span> {info.weaknesses.join("; ")}
              </div>
            </div>
            {getDraftWarning(info.id, info.role, info.range) && (
              <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
                ⚠ {getDraftWarning(info.id, info.role, info.range)}
              </p>
            )}
            {getGuideEntry(info.id) &&
              (() => {
                const guide = getGuideEntry(info.id)!;
                const matchupGuide = getMatchupGuideEntry(info.id);
                const counterTargets = getGuideCounterTargets(info.id);
                const hardCounterTargets = getGuideHardCounterTargets(info.id);
                return (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    {counterTargets.length > 0 && (
                      <p>
                        <span className="font-semibold text-good">Countera melhor:</span>{" "}
                        {counterTargets.map(brawlerName).join(", ")}
                      </p>
                    )}
                    {matchupGuide && matchupGuide.counteredBy.length > 0 && (
                      <p>
                        <span className="font-semibold text-bad">É counterado por:</span>{" "}
                        {matchupGuide.counteredBy.map(brawlerName).join(", ")}
                      </p>
                    )}
                    {matchupGuide && matchupGuide.hardCounters.length > 0 && (
                      <p>
                        <span className="font-semibold text-bad">Hard counters:</span>{" "}
                        {matchupGuide.hardCounters.map(brawlerName).join(", ")}
                      </p>
                    )}
                    {hardCounterTargets.length > 0 && (
                      <p>
                        <span className="font-semibold text-good">É hard counter de:</span>{" "}
                        {hardCounterTargets.map(brawlerName).join(", ")}
                      </p>
                    )}
                    {guide.synergies.length > 0 && (
                      <p>
                        <span className="font-semibold text-primary">Sinergias recomendadas:</span>{" "}
                        {guide.synergies.map(brawlerName).join(", ")}
                      </p>
                    )}
                    {guide.maps.length > 0 && (
                      <p>
                        <span className="font-semibold">Mapas de destaque:</span>{" "}
                        {guide.maps.map(mapName).join(", ")}
                      </p>
                    )}
                    {guide.worstMaps.length > 0 && (
                      <p>
                        <span className="font-semibold text-bad">Mapas desfavoráveis:</span>{" "}
                        {guide.worstMaps.map(mapName).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })()}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {list.map((b) => {
            const unavailable = b.available === false;
            const isBanned = banned.has(b.id);
            const used = (taken.has(b.id) && b.id !== current) || unavailable || isBanned;
            return (
              <div
                key={b.id}
                className={cn(
                  "group relative rounded-lg border border-border bg-surface p-2 transition hover:border-primary/60",
                  used && !isBanned && "opacity-35",
                  isBanned && "border-bad/50 bg-bad/10",
                  b.id === current && "border-primary",
                )}
              >
                <button
                  disabled={used}
                  onClick={() => onPick(b.id)}
                  className="flex w-full flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                  aria-label={
                    isBanned
                      ? `${displayBrawlerName(b, locale)}, brawler banido`
                      : `Selecionar ${displayBrawlerName(b, locale)}`
                  }
                >
                  <span className="relative">
                    <Portrait brawler={b} />
                    {isBanned && (
                      <Ban
                        aria-hidden="true"
                        className="absolute -left-1 -top-1 size-6 stroke[3] text-red-500 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                      />
                    )}
                  </span>
                  <span className="truncate text-xs font-semibold">
                    {displayBrawlerName(b, locale)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold",
                      RARITY_STYLES[b.rarity],
                    )}
                  >
                    {displayRarity(b.rarity, locale)}
                  </span>
                  <span className="flex flex-wrap justify-center gap-1">
                    {getGuideBadges(b.id, b.role, b.range, b).map((badge) => (
                      <span
                        key={badge}
                        className={
                          badge.startsWith("⚠")
                            ? "rounded bg-red-500/10 px-1 py-0.5 text-[8px] font-bold text-red-400"
                            : "rounded bg-primary/10 px-1 py-0.5 text-[8px] font-bold text-primary"
                        }
                      >
                        {badge}
                      </span>
                    ))}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {isBanned
                      ? "Banido"
                      : unavailable
                        ? "Indisponível"
                        : taken.has(b.id) && b.id !== current
                          ? "Já escolhido"
                          : displayRole(b.role, locale)}
                  </span>
                </button>
                <button
                  onClick={() => setInfo(b)}
                  className="absolute right-1 top-1 z-10 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={`${locale === "en" ? "Information about" : "Informações de"} ${displayBrawlerName(b, locale)}`}
                >
                  <Info className="size-3.5" />
                </button>
              </div>
            );
          })}
          {!list.length && (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              Nenhum brawler encontrado.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  active,
  children,
  ...p
}: { active: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold transition disabled:opacity-40",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
