import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { Brawler, DataStatus } from "@/lib/draft/types";
import { getBrawlerImageAsset, type BrawlerImageAsset } from "@/lib/draft/brawler-images";

// eslint-disable-next-line react-refresh/only-export-components
export function useBrawlerImage(brawler: Brawler): BrawlerImageAsset | null {
  const [asset, setAsset] = useState<BrawlerImageAsset | null>(null);
  useEffect(() => {
    let active = true;
    getBrawlerImageAsset(brawler.name, brawler.imageAlias).then((value) => {
      if (active) setAsset(value);
    });
    return () => {
      active = false;
    };
  }, [brawler.name, brawler.imageAlias]);
  return asset;
}

export function Portrait({
  brawler,
  size = "md",
  className,
}: {
  brawler: Brawler;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const s =
    size === "sm" ? "size-9 text-xs" : size === "lg" ? "size-20 text-2xl" : "size-14 text-base";
  const asset = useBrawlerImage(brawler);
  return (
    <div
      data-role={brawler.role}
      className={cn(
        "role-tile relative grid shrink-0 place-items-center overflow-hidden rounded-md font-display font-bold",
        s,
        className,
      )}
      title={
        asset
          ? `Imagem de ${brawler.name} · fonte: Brawlify`
          : `${brawler.name} · imagem indisponível offline`
      }
    >
      {asset ? (
        <img
          src={asset.imageUrl}
          alt={`Imagem de ${brawler.name}`}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span>{brawler.name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}

export function BrawlerImageLink({ brawler }: { brawler: Brawler }) {
  const asset = useBrawlerImage(brawler);
  if (!asset)
    return <span className="text-xs text-muted-foreground">Link da imagem indisponível</span>;
  return (
    <a
      className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
      href={asset.imageUrl}
      target="_blank"
      rel="noreferrer"
    >
      Abrir imagem ↗
    </a>
  );
}

export function MatchupChip({
  score,
  known = true,
  className,
}: {
  score: number;
  known?: boolean;
  className?: string;
}) {
  const tone = !known
    ? "border-dashed border-neutral/60 text-neutral"
    : score > 0
      ? "border-good/50 bg-good/15 text-good"
      : score < 0
        ? "border-bad/50 bg-bad/15 text-bad"
        : "border-neutral/50 bg-neutral/10 text-neutral";
  const emphasis =
    known && score === 5
      ? "matchup-hard-advantage"
      : known && score === -5
        ? "matchup-hard-counter"
        : "";
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded border px-1.5 py-0.5 font-display text-sm font-bold tabular-nums",
        tone,
        emphasis,
        className,
      )}
      title={known ? "Matchup estratégico" : "Sem dados (neutro)"}
    >
      {!known ? "?" : score > 0 ? `+${score}` : score}
    </span>
  );
}

const STATUS_LABEL: Record<DataStatus, string> = {
  confirmado: "Confirmado",
  fonte_externa: "Fonte externa",
  avaliacao_manual: "Avaliação manual",
  estimativa: "Estimativa",
  nao_verificado: "Não verificado",
};
export function StatusBadge({ status }: { status: DataStatus }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "confirmado" ? "bg-good/15 text-good" : "bg-muted text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
export function ScoreRing({ value, size = "md" }: { value: number; size?: "md" | "lg" }) {
  const s = size === "lg" ? "size-20 text-2xl" : "size-14 text-lg";
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full font-display font-bold",
        s,
      )}
      style={{ background: `conic-gradient(var(--primary) ${value * 3.6}deg, var(--muted) 0)` }}
      title="Nota estratégica (não é probabilidade de vitória)"
    >
      <div className="absolute inset-1 rounded-full bg-card" />
      <span className="relative tabular-nums">{value}</span>
    </div>
  );
}

export function DemoNotice() {
  return (
    <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
      Beta: o iDrafty está em desenvolvimento. Matchups, sinergias e atributos podem conter
      imprecisões e não são estatísticas oficiais. Notas são graus estratégicos, não chances de
      vitória.
    </p>
  );
}
