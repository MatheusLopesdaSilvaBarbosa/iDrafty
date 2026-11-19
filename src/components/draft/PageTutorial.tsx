import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface TutorialStep {
  title: string;
  description: string;
  target?: string;
  completed?: boolean;
  advanceOnTargetClick?: boolean;
  finishOnTargetClick?: boolean;
  showInDialog?: boolean;
  waitForCompletion?: boolean;
  scrollTarget?: string;
  dialogSide?: "left" | "right";
}

type Anchor = {
  left: number;
  top: number;
  width: number;
  target: DOMRect | null;
};

const CARD_WIDTH = 360;
const CARD_HEIGHT = 270;

export function PageTutorial({
  pageId,
  title,
  steps,
  revision = "2",
}: {
  pageId: string;
  title: string;
  steps: TutorialStep[];
  revision?: string;
}) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [suspended, setSuspended] = useState(false);
  const completionRef = useRef({ stepIndex: -1, completed: false });
  const storageKey = `draftiq:tutorial:v${revision}:${pageId}`;
  const activeStep = steps[stepIndex];

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(storageKey) !== "completed");
    } catch {
      setOpen(false);
    }
    setReady(true);
  }, [storageKey]);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey, "completed");
    } catch {
      // The tutorial still closes for this visit if browser storage is unavailable.
    }
    setOpen(false);
  }, [storageKey]);

  const advance = useCallback(() => {
    if (stepIndex >= steps.length - 1) finish();
    else setStepIndex((index) => index + 1);
  }, [finish, stepIndex, steps.length]);

  useEffect(() => {
    if (!open || !activeStep) return;
    const completed = !!activeStep.completed;
    const enteredStep = completionRef.current.stepIndex !== stepIndex;
    if (enteredStep) {
      completionRef.current = { stepIndex, completed };
    }
    const newlyCompleted = !enteredStep && completed && !completionRef.current.completed;
    completionRef.current.completed = completed;
    if (!newlyCompleted && !(enteredStep && activeStep.waitForCompletion && completed)) return;
    const timeout = window.setTimeout(advance, 450);
    return () => window.clearTimeout(timeout);
  }, [open, activeStep?.completed, stepIndex, advance]);

  useEffect(() => {
    if (!open || !activeStep) return;
    const getTarget = () => {
      if (!activeStep.target) return null;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(activeStep.target));
      return candidates.find((candidate) => candidate.getClientRects().length > 0) ?? null;
    };
    const initialTarget = getTarget();
    const getScrollTarget = () => {
      if (!activeStep.scrollTarget) return initialTarget;
      return (
        Array.from(document.querySelectorAll<HTMLElement>(activeStep.scrollTarget)).find(
          (candidate) => candidate.getClientRects().length > 0,
        ) ?? initialTarget
      );
    };
    getScrollTarget()?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const handleTargetClick = (event: MouseEvent) => {
      if (!activeStep.target || !(event.target instanceof Element)) return;
      const path = event.composedPath();
      if (initialTarget ? !path.includes(initialTarget) : !event.target.closest(activeStep.target)) return;
      if (activeStep.finishOnTargetClick) finish();
      else if (activeStep.advanceOnTargetClick) advance();
    };
    document.addEventListener("click", handleTargetClick);

    const update = () => {
      setSuspended(!activeStep.showInDialog && !!document.querySelector("[role='dialog'][aria-modal='true'], [role='alertdialog'][aria-modal='true']"));
      const target = getTarget();
      const rect = target?.isConnected ? target.getBoundingClientRect() : null;
      const width = Math.min(CARD_WIDTH, window.innerWidth - 24);
      const dialog = activeStep.showInDialog
        ? target?.closest<HTMLElement>("[role='dialog'][aria-modal='true'], [role='alertdialog'][aria-modal='true']")
        : null;
      const dialogRect = dialog?.getBoundingClientRect();
      let left = rect
        ? Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))
        : Math.max(12, (window.innerWidth - width) / 2);
      let top: number;
      if (dialogRect) {
        const rightSpace = window.innerWidth - dialogRect.right - 12;
        const leftSpace = dialogRect.left - 12;
        const scrollRect = getScrollTarget()?.getBoundingClientRect();
        if (activeStep.dialogSide === "left" && leftSpace >= width) {
          left = dialogRect.left - width - 12;
          top = Math.max(12, Math.min(window.innerHeight - CARD_HEIGHT - 12, dialogRect.top + dialogRect.height / 2 - CARD_HEIGHT / 2));
        } else if (activeStep.dialogSide === "right" && rightSpace >= width) {
          left = dialogRect.right + 12;
          top = Math.max(12, Math.min(window.innerHeight - CARD_HEIGHT - 12, dialogRect.top + dialogRect.height / 2 - CARD_HEIGHT / 2));
        } else if (activeStep.dialogSide === "right" && leftSpace >= width) {
          left = dialogRect.left - width - 12;
          top = Math.max(12, Math.min(window.innerHeight - CARD_HEIGHT - 12, dialogRect.top + dialogRect.height / 2 - CARD_HEIGHT / 2));
        } else if (rightSpace >= width) {
          left = dialogRect.right + 12;
          top = Math.max(12, Math.min(window.innerHeight - CARD_HEIGHT - 12, dialogRect.top + dialogRect.height / 2 - CARD_HEIGHT / 2));
        } else if (leftSpace >= width) {
          left = dialogRect.left - width - 12;
          top = Math.max(12, Math.min(window.innerHeight - CARD_HEIGHT - 12, dialogRect.top + dialogRect.height / 2 - CARD_HEIGHT / 2));
        } else {
          left = Math.max(12, (window.innerWidth - width) / 2);
          top = scrollRect && scrollRect.top + scrollRect.height / 2 < window.innerHeight / 2
            ? Math.max(12, window.innerHeight - CARD_HEIGHT - 12)
            : 12;
        }
      } else {
        const belowFits = rect && rect.bottom + CARD_HEIGHT + 16 < window.innerHeight;
        top = rect
          ? belowFits
            ? rect.bottom + 12
            : Math.max(12, rect.top - CARD_HEIGHT - 12)
          : Math.max(12, window.innerHeight - CARD_HEIGHT - 24);
      }
      setAnchor((previous) => {
        if (
          previous &&
          previous.left === left &&
          previous.top === top &&
          previous.width === width &&
          previous.target?.left === rect?.left &&
          previous.target?.top === rect?.top &&
          previous.target?.width === rect?.width &&
          previous.target?.height === rect?.height
        )
          return previous;
        return { left, top, width, target: rect };
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(document.body);
    const mutations = new MutationObserver(update);
    mutations.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-modal", "class", "data-state", "data-tutorial", "hidden", "role"],
      childList: true,
      subtree: true,
    });
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("click", handleTargetClick);
      observer?.disconnect();
      mutations.disconnect();
    };
  }, [open, activeStep?.target, activeStep?.scrollTarget, activeStep?.advanceOnTargetClick, activeStep?.finishOnTargetClick, activeStep?.showInDialog, stepIndex, advance, finish]);

  if (
    !ready ||
    !open ||
    !activeStep ||
    !anchor ||
    suspended ||
    activeStep.waitForCompletion
  ) return null;

  return createPortal(
    <>
      {anchor.target && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[55] rounded-xl ring-2 ring-sky-300 shadow-[0_0_0_9999px_rgba(2,8,23,.68),0_0_28px_rgba(56,189,248,.48)] transition-all duration-200"
          style={{
            left: anchor.target.left - 5,
            top: anchor.target.top - 5,
            width: anchor.target.width + 10,
            height: anchor.target.height + 10,
          }}
        />
      )}
      <section
        role="region"
        aria-label={`Tutorial: ${title}`}
        aria-live="polite"
        className="pointer-events-auto fixed z-[60] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl border border-sky-300/25 bg-[#101b2b] p-4 text-slate-100 shadow-[0_24px_80px_-28px_rgba(56,189,248,.58)] sm:p-5"
        style={{ left: anchor.left, top: anchor.top, width: anchor.width }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-2xl bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,.14),transparent_75%)]" />
        <div className="relative">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/15 bg-sky-300/10 text-sky-200">
              <BookOpen className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-sky-300">
                Tutorial · {title}
              </p>
              <h2 className="mt-1 font-display text-lg font-bold leading-tight">{activeStep.title}</h2>
            </div>
            <span className="shrink-0 rounded-full border border-slate-400/15 bg-white/[0.04] px-2 py-1 text-[10px] font-bold tabular-nums text-slate-400">
              {stepIndex + 1}/{steps.length}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-300">{activeStep.description}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-700/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-300 to-amber-300 transition-[width] duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={finish}
              className="h-8 px-2 text-[11px] text-slate-400 hover:text-slate-100"
            >
              <SkipForward className="size-3.5" /> Pular tutorial
            </Button>
            <div className="flex items-center gap-1.5">
              {stepIndex > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStepIndex((index) => index - 1)}
                  className="h-8 px-2.5 text-[11px]"
                  aria-label="Etapa anterior"
                >
                  <ChevronLeft className="size-3.5" /> Voltar
                </Button>
              )}
              <Button
                size="sm"
                onClick={advance}
                disabled={activeStep.waitForCompletion && !activeStep.completed}
                className="h-8 px-2.5 text-[11px]"
              >
                {activeStep.waitForCompletion && !activeStep.completed
                  ? "Draft em andamento"
                  : stepIndex === steps.length - 1
                    ? "Concluir"
                    : "Pr\u00f3ximo"}
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>,
    document.body,
  );
}
