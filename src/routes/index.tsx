import { createFileRoute, Link } from "@tanstack/react-router";
import { BRAWLER_BY_ID } from "@/data/brawlers";
import { Portrait } from "@/components/draft/ui-bits";
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Check,
  Crosshair,
  Database,
  Layers3,
  ScanLine,
  Sparkles,
  Swords,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "iDrafty — Estratégia para seu draft" },
      {
        name: "description",
        content:
          "Planeje seu draft de Brawl Stars, compare matchups e monte sua composição com mais contexto.",
      },
      { property: "og:title", content: "iDrafty — Estratégia para seu draft" },
      {
        property: "og:description",
        content:
          "Planeje seu draft de Brawl Stars, compare matchups e monte sua composição com mais contexto.",
      },
    ],
  }),
  component: LandingPage,
});

const TOOLS = [
  {
    number: "01",
    icon: Target,
    title: "Last pick",
    description: "Analise as melhores últimas opções para ganhar do time adversário.",
    to: "/last-pick",
    color: "text-sky-300",
    glow: "bg-sky-300/10",
  },
  {
    number: "02",
    icon: Crosshair,
    title: "Matchups",
    description: "Analise cada brawler e veja suas vantagens e desvantagens.",
    to: "/matchups",
    color: "text-amber-300",
    glow: "bg-amber-400/10",
  },
  {
    number: "03",
    icon: Layers3,
    title: "Composição",
    description:
      "Identifique as vantagens e as desvantagens da sua composição e commpare com a do adversário.",
    to: "/composicao",
    color: "text-slate-200",
    glow: "bg-slate-300/10",
  },
  {
    number: "04",
    icon: Database,
    title: "Banco de dados",
    description:
      "Adapte o iDraft da forma que desejar. Você pode controlar as vantagens e desvantagens dentro da aba de Banco.",
    to: "/banco",
    color: "text-rose-300",
    glow: "bg-rose-400/10",
  },
] as const;

function LandingPage() {
  return (
    <div className="space-y-16 pb-12 sm:space-y-24">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-sky-300/15 bg-[#0b1423] shadow-[0_32px_100px_-48px_rgba(56,189,248,0.35)]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_30%,rgba(56,189,248,0.16),transparent_42%),radial-gradient(ellipse_at_5%_100%,rgba(250,204,21,0.08),transparent_35%)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.12] [background-image:linear-gradient(rgba(148,163,184,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.22)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

        <div className="grid items-center gap-12 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.04fr_.96fr] lg:gap-8 lg:px-16 lg:py-20">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-sky-200">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              Central de estratégia · Brawl Stars
            </div>
            <h1 className="max-w-2xl font-display text-5xl font-bold leading-[0.98] tracking-tight text-slate-50 sm:text-6xl lg:text-7xl">
              Cansado de
              <span className="text-sky-300"> pickar mal?</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              O draft vem antes da gameplay. Ganhe no draft e facilite a sua partida. O iDrafty
              analisa todo o contexto do jogo e te recomenda o melhor brawler para cada situação.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/draft"
                className="group inline-flex h-12 items-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-extrabold text-slate-950 shadow-[0_8px_30px_-12px_rgba(253,224,71,.8)] transition hover:-translate-y-0.5 hover:bg-amber-200"
              >
                <Swords className="size-4" /> Abrir central de draft
                <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#ferramentas"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-500/40 bg-white/[0.03] px-5 text-sm font-bold text-slate-200 transition hover:border-slate-300/60 hover:bg-white/[0.07]"
              >
                Conhecer ferramentas <ArrowDownRight className="size-4" />
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Draft guiado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Matchups contextualizados
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Dados editáveis
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[490px] lg:ml-auto">
            <div className="absolute -inset-8 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="relative rotate-1 rounded-2xl border border-slate-400/20 bg-[#101d30]/95 p-4 shadow-2xl backdrop-blur sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-500/20 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sky-300/10 text-sky-200">
                    <ScanLine className="size-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Draft ao vivo
                    </p>
                    <p className="text-sm font-bold text-slate-100">Leitura da partida</p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  Preparado
                </span>
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-2 rounded-xl border border-slate-500/15 bg-slate-950/35 p-3 sm:gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-sky-300">
                    Seu time
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <PickTile initials="" tone="blue" />
                    <PickTile initials="?" tone="empty" />
                    <PickTile initials="?" tone="empty" />
                  </div>
                </div>
                <span className="w-10 justify-self-center text-center font-display text-xs font-bold text-slate-600">
                  VS
                </span>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-rose-300">
                    Adversário
                  </p>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <div className="flex size-9 items-center justify-center overflow-hidden rounded-lg border border-rose-200/40 bg-gradient-to-br from-rose-300/30 to-red-800/40">
                      <Portrait
                        brawler={BRAWLER_BY_ID.dynamike}
                        size="sm"
                        className="size-full rounded-none"
                      />
                    </div>
                    <PickTile initials="?" tone="empty" />
                    <PickTile initials="?" tone="empty" />
                  </div>
                </div>
              </div>

              <div className="relative mt-3 overflow-hidden rounded-xl border border-amber-200/20 bg-gradient-to-r from-amber-200/[0.09] via-slate-950/40 to-sky-300/[0.07] p-3.5 sm:p-4">
                <div className="pointer-events-none absolute -right-8 -top-12 size-32 rounded-full bg-amber-200/10 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-100">
                    <Crosshair className="size-4 text-amber-300" />
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.16em]">
                      Resposta recomendada
                    </span>
                  </div>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-extrabold text-emerald-200">
                    +5 de Vantagem
                  </span>
                </div>
                <div className="relative mt-3 grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Portrait
                      brawler={BRAWLER_BY_ID.mortis}
                      size="md"
                      className="size-12 rounded-xl border border-amber-200/25 shadow-lg"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-xl font-bold leading-none text-slate-50">
                        Mortis
                      </p>
                      <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                        Vantagem recomendada
                      </p>
                    </div>
                  </div>
                  <span className="w-10 justify-self-center text-center font-display text-lg font-bold text-slate-600">
                    VS
                  </span>
                  <div className="flex min-w-0 items-center justify-self-start gap-2">
                    <Portrait
                      brawler={BRAWLER_BY_ID.dynamike}
                      size="sm"
                      className="size-10 rounded-lg border border-rose-300/20"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-xl font-bold leading-none text-slate-50">
                        Dynamike
                      </p>
                      <p className="mt-1.5 text-[10px] leading-4 text-slate-400">Adversário</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.06] p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-300/15 text-sky-200">
                  <BarChart3 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-sky-200">
                    Análise de matchup
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-300">
                    Compare ameaças, sinergias e opções
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-sky-200" />
              </div>
              <div className="absolute -right-3 -top-3 flex size-10 items-center justify-center rounded-xl border border-rose-300/25 bg-[#351b2a] text-rose-200 shadow-lg sm:-right-4 sm:-top-4">
                <Sparkles className="size-4" />
              </div>
            </div>
            <p className="relative mt-4 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
              Leia o jogo. Controle as escolhas.
            </p>
          </div>
        </div>
      </section>

      <section id="ferramentas" className="scroll-mt-24">
        <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-sky-300">
              Seu arsenal estratégico
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-100 sm:text-4xl">
              Decisões melhores, em cada etapa.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-400">
            Da leitura do mapa à composição final, tenha mais contexto para escolher.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map(({ number, icon: Icon, title, description, to, color, glow }) => (
            <Link
              key={to}
              to={to}
              className="group relative overflow-hidden rounded-2xl border border-slate-400/15 bg-[#111b2a] p-5 transition duration-300 hover:-translate-y-1 hover:border-sky-300/40 hover:bg-[#142238]"
            >
              <div
                className={`absolute -right-8 -top-8 size-28 rounded-full blur-2xl transition group-hover:opacity-150 ${glow}`}
              />
              <div className="relative flex items-start justify-between">
                <div
                  className={`flex size-11 items-center justify-center rounded-xl border border-white/5 ${glow} ${color}`}
                >
                  <Icon className="size-5" />
                </div>
                <span className="font-display text-xs font-bold tracking-widest text-slate-600">
                  {number}
                </span>
              </div>
              <h3 className="relative mt-6 font-display text-xl font-bold text-slate-100">
                {title}
              </h3>
              <p className="relative mt-2 min-h-[4.5rem] text-sm leading-6 text-slate-400">
                {description}
              </p>
              <span
                className={`relative mt-4 inline-flex items-center gap-2 text-xs font-bold ${color}`}
              >
                Explorar{" "}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[1.75rem] border border-slate-400/15 bg-[#101a29] px-6 py-8 sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute -right-12 -top-24 size-64 rounded-full bg-amber-300/[0.08] blur-3xl" />
        <div className="relative grid gap-8 md:grid-cols-[.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-300">
              Fluxo de draft
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-100">
              Do mapa ao último pick.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
              Uma sequência clara para preparar a partida e adaptar seu plano conforme as escolhas
              aparecem.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Step number="01" title="Configure" detail="Modo, mapa e ordem de escolha." />
            <Step number="02" title="Acompanhe" detail="Registre os picks e bans." />
            <Step number="03" title="Adapte" detail="Compare respostas e feche a comp." />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[1.75rem] border border-sky-300/20 bg-gradient-to-br from-[#142b43] via-[#132238] to-[#171d2c] px-6 py-10 text-center sm:px-12 sm:py-14">
        <div className="pointer-events-none absolute left-1/2 top-0 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="relative mx-auto flex size-12 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-200">
          <Swords className="size-5" />
        </div>
        <p className="relative mt-5 text-[10px] font-extrabold uppercase tracking-[0.28em] text-sky-200">
          Sua próxima partida começa aqui
        </p>
        <h2 className="relative mt-2 font-display text-3xl font-bold text-slate-50 sm:text-4xl">
          Entre no draft com um plano.
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
          Pare de ganhar somente por habilidade. Está na hora de ganhar por escolher certo. Escolha
          com iDraft.
        </p>
        <Link
          to="/draft"
          className="group relative mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-extrabold text-slate-950 transition hover:bg-amber-200"
        >
          Começar agora{" "}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>
    </div>
  );
}

function PickTile({
  initials,
  tone,
}: {
  initials: string;
  tone: "blue" | "silver" | "empty" | "red";
}) {
  const tones = {
    blue: "border-sky-200/40 bg-gradient-to-br from-sky-300/30 to-blue-700/40 text-sky-100",
    silver:
      "border-slate-200/30 bg-gradient-to-br from-slate-200/25 to-slate-600/30 text-slate-100",
    empty: "border-dashed border-slate-500/50 bg-slate-800/30 text-slate-500",
    red: "border-rose-200/40 bg-gradient-to-br from-rose-300/30 to-red-800/40 text-rose-100",
  };
  return (
    <span
      className={`flex size-9 items-center justify-center rounded-lg border font-display text-sm font-bold ${tones[tone]}`}
    >
      {initials}
    </span>
  );
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-400/15 bg-slate-950/25 p-4">
      <span className="font-display text-[10px] font-bold tracking-[0.2em] text-sky-300">
        PASSO {number}
      </span>
      <h3 className="mt-2 font-display text-lg font-bold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
