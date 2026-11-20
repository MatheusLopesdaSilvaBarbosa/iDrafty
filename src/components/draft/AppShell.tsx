import { Link } from "@tanstack/react-router";
import {
  Crosshair,
  Database,
  Globe2,
  Layers,
  MessageCircle,
  Music2,
  Swords,
  Target,
  Youtube,
} from "lucide-react";
import type { ReactNode } from "react";
import { t, useLocale } from "@/lib/i18n";

const NAV = [
  { to: "/draft", label: "Draft", icon: Swords },
  { to: "/last-pick", label: "Last Pick", icon: Target },
  { to: "/matchups", label: "Matchups", icon: Crosshair },
  { to: "/composicao", label: "Composição", icon: Layers },
  { to: "/banco", label: "Banco", icon: Database },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { locale, setLocale } = useLocale();
  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <header className="site-header sticky top-0 z-30">
        <div className="site-header-inner mx-auto flex h-[4.25rem] max-w-7xl items-center gap-7 px-4 sm:px-6">
          <Link
            to="/"
            className="site-brand shrink-0 font-display text-xl font-bold tracking-wider"
          >
            <img
              src="/iDrafty-icon.png"
              alt=""
              className="mr-2 inline-block size-8 rounded-lg object-contain align-middle"
            />
            <span className="align-middle">iDrafty</span>
          </Link>
          <nav className="site-nav hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                data-tutorial-nav={n.to === "/draft" ? "draft" : undefined}
                activeOptions={{ exact: true }}
                className="site-nav-link rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition"
                activeProps={{ className: "site-nav-link-active" }}
              >
                <n.icon className="size-4" />
                {t(n.label, locale)}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            aria-label={locale === "en" ? "Switch language to Portuguese" : "Mudar idioma para inglês"}
            title={locale === "en" ? "Português (Brasil)" : "English"}
            onClick={() => setLocale(locale === "en" ? "pt-BR" : "en")}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-400/20 bg-[#101b2b] px-2.5 py-1.5 text-xs font-bold text-foreground transition hover:border-sky-300/40 hover:text-sky-200 md:ml-0"
          >
            <Globe2 aria-hidden="true" className="size-4" />
            <span>{locale === "en" ? "EN" : "PT"}</span>
          </button>
        </div>
      </header>
      <main className="site-main mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8">{children}</main>
      <footer className="mx-auto mt-8 flex max-w-7xl flex-col gap-4 border-t border-slate-400/10 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs font-semibold text-slate-400">{t("Acompanhe o iDrafty", locale)}</p>
        <nav aria-label="Redes sociais" className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.youtube.com/channel/UCZK4hkxgCBWXfjskvxMzyhA"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-400/15 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-red-300/30 hover:text-red-200"
          >
            <Youtube className="size-4" /> YouTube
          </a>
          <a
            href="https://www.tiktok.com/@aykiibs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-400/15 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-sky-300/30 hover:text-sky-200"
          >
            <Music2 className="size-4" /> TikTok
          </a>
          <a
            href="https://discord.gg/3kSGrJexR"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-400/15 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-indigo-300/30 hover:text-indigo-200"
          >
            <MessageCircle className="size-4" /> Discord
          </a>
        </nav>
      </footer>
      <nav className="site-mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            data-tutorial-nav={n.to === "/draft" ? "draft" : undefined}
            activeOptions={{ exact: true }}
            className="site-mobile-link flex flex-col items-center gap-1 py-2 text-[10px] font-semibold text-muted-foreground"
            activeProps={{ className: "site-mobile-link-active" }}
          >
            <n.icon className="size-5" />
            {t(n.label, locale)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
