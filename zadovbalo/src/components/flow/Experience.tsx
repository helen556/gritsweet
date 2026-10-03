"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { StormHero } from "@/components/hero/StormHero";
import { HeroFirst } from "@/components/hero/HeroCopy";
import { SiteFooter, SiteHeader } from "@/components/ui/SiteChrome";
import type { SceneExit } from "@/components/scenes/SceneShell";
import { extractAmounts, pickAmount } from "@/lib/ai/amount";
import { createAnalyzer, type ClientReason } from "@/lib/ai/client";
import { localRoute } from "@/lib/ai/route";
import { track } from "@/lib/analytics/track";
import { splitPhrases } from "@/lib/text";
import { flowReducer, initialFlow } from "./state";

// Усе після першого екрана — окремими чанками: перший екран не чекає на їхній JS.
const RantInput = dynamic(() => import("@/components/input/RantInput").then((m) => m.RantInput));
const VoiceInput = dynamic(() => import("@/components/input/VoiceInput").then((m) => m.VoiceInput));
const Analyzing = dynamic(() => import("@/components/ai/Analyzing").then((m) => m.Analyzing));
const SceneHost = dynamic(() => import("@/components/scenes/SceneHost").then((m) => m.SceneHost));
const SafetyFlow = dynamic(() => import("@/components/safety/SafetyFlow").then((m) => m.SafetyFlow));
const Choose = dynamic(() => import("./Choices").then((m) => m.Choose));
const Clarify = dynamic(() => import("./Choices").then((m) => m.Clarify));
const Manual = dynamic(() => import("./Choices").then((m) => m.Manual));
const WarChoice = dynamic(() => import("./Choices").then((m) => m.WarChoice));
const Finish = dynamic(() => import("./Choices").then((m) => m.Finish));
const DebtSetup = dynamic(() => import("./Setup").then((m) => m.DebtSetup));
const LabelsSetup = dynamic(() => import("./Setup").then((m) => m.LabelsSetup));

const BACKPACK_EXAMPLES = ["Робота", "Дім", "Рахунки", "Діти", "Навчання", "Здоровʼя", "Чужі очікування"];

export function Experience() {
  const [state, dispatch] = useReducer(flowReducer, initialFlow);
  const analyzer = useRef(createAnalyzer());
  const reduced = useReducedMotion();
  const { stage } = state;

  useEffect(() => {
    const a = analyzer.current;
    return () => a.cancel();
  }, []);

  useEffect(() => {
    if (stage === "scene") track("scene_started");
  }, [stage, state.scene]);

  // Новий етап починається згори (після довгих списків сторінка могла бути прокручена).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [stage]);

  const leaveHero = () => {
    if (stage === "hero") track("hero_started");
  };

  /** Правила за словами в тексті — на пристрої, без передачі. Ніколи не називаються AI. */
  const routeLocally = useCallback((text: string, reason: ClientReason | null) => {
    const picked = pickAmount(extractAmounts(text));
    dispatch({ type: "local", route: localRoute(text), reason, amount: picked?.amount ?? null, currency: picked?.currency ?? null });
  }, []);

  const analyze = useCallback(
    async (text: string) => {
      dispatch({ type: "analyze" });
      track("text_submitted");
      const res = await analyzer.current.analyze(text);
      switch (res.status) {
        case "stale":
          return; // відповідь запізнилась: людина вже скасувала, змінила текст чи почала заново
        case "ok":
          return dispatch({ type: "analyzed", analysis: res.analysis, warMood: localRoute(text).warMood });
        case "support":
          return dispatch({ type: "support" });
        case "manual":
          track("manual_choice_opened");
          return routeLocally(text, res.reason);
        case "invalid_input":
          return dispatch({ type: "write" });
      }
    },
    [routeLocally],
  );

  const reset = () => {
    analyzer.current.cancel();
    dispatch({ type: "reset" });
  };

  const openManual = () => {
    leaveHero();
    analyzer.current.cancel();
    track("manual_choice_opened");
    dispatch({ type: "manual", reason: null });
  };

  const onSceneExit = (kind: SceneExit) => {
    track("scene_finished");
    if (kind === "change") return dispatch({ type: "change_scene" });
    reset();
    if (kind === "write") dispatch({ type: "write" });
  };

  const onTranscript = useCallback((text: string) => dispatch({ type: "transcribed", text }), []);
  const inScene = stage === "scene" && state.scene;
  const topicNote = state.source === "ai" ? "Тему визначено автоматично." : state.source === "local" ? "Тему підібрано за словами в тексті." : null;

  return (
    <>
      <StormHero scene={stage === "hero" ? "storm" : "calm"} still={stage === "support" || Boolean(inScene)} />
      <SiteHeader />

      <motion.div
        className="relative z-10 flex min-h-dvh flex-col"
        aria-hidden={inScene ? true : undefined}
        inert={inScene ? true : undefined}
        // Вхід у сцену: інтерфейс відходить углиб і гасне, світло змінюється.
        animate={inScene && !reduced ? { scale: 0.92, opacity: 0, filter: "brightness(0.5)" } : { scale: 1, opacity: 1, filter: "brightness(1)" }}
        transition={{ duration: reduced ? 0.2 : 0.7, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <main className="safe-px flex flex-1 flex-col items-center justify-center pb-10 pt-24">
          <AnimatePresence mode="wait">
            {stage === "hero" && (
              <HeroFirst
                key="hero"
                onWrite={() => {
                  leaveHero();
                  dispatch({ type: "write" });
                }}
                onDictate={() => {
                  leaveHero();
                  dispatch({ type: "dictate" });
                }}
                onManual={openManual}
              />
            )}

            {stage === "write" && (
              <RantInput
                key="write"
                value={state.text}
                onChange={(text) => dispatch({ type: "edit", text })}
                onSubmit={() => void analyze(state.text)}
                onLocal={() => routeLocally(state.text, null)}
                onDictate={() => dispatch({ type: "dictate" })}
                onManual={openManual}
              />
            )}

            {stage === "dictate" && <VoiceInput key="dictate" onTranscript={onTranscript} onWrite={() => dispatch({ type: "write" })} />}

            {stage === "analyzing" && (
              <Analyzing
                key="analyzing"
                onCancel={() => {
                  analyzer.current.cancel();
                  dispatch({ type: "write" });
                }}
              />
            )}

            {stage === "choose" && (
              <Choose key={`choose-${state.options.join()}`} options={state.options} source={state.source} onScene={(scene) => dispatch({ type: "choose_scene", scene })} onOther={openManual} />
            )}

            {stage === "clarify" && <Clarify key="clarify" categories={state.options} onCategory={(category) => dispatch({ type: "choose_category", category })} onOther={openManual} />}

            {stage === "manual" && (
              <Manual
                key="manual"
                reason={state.manualReason}
                suggestions={state.keywordSuggestions}
                onScene={(scene) => dispatch({ type: "choose_scene", scene })}
                onSupport={() => dispatch({ type: "support" })}
              />
            )}

            {stage === "war_choice" && <WarChoice key="war" mood={state.warMood} onScene={(scene) => dispatch({ type: "choose_scene", scene })} />}

            {stage === "setup" && state.scene === "debt" && (
              <DebtSetup
                key="setup-debt"
                amount={state.extracted.amount}
                currency={state.extracted.currency}
                onDone={(amount, currency) => dispatch({ type: "setup_done", input: { amount, currency } })}
                onBack={openManual}
              />
            )}
            {stage === "setup" && state.scene === "backpack" && (
              <LabelsSetup
                key="setup-backpack"
                title="Що ти зараз тягнеш на собі?"
                intro="Кілька коротких назв для каменів — з твого тексту. Можна змінити, додати свої або лишити камені без назв."
                initial={splitPhrases(state.text, 6)}
                examples={BACKPACK_EXAMPLES}
                onDone={(labels) => dispatch({ type: "setup_done", input: { labels } })}
                onBack={openManual}
              />
            )}

            {stage === "finish" && (
              <Finish
                key="finish"
                onOther={() => dispatch({ type: "change_scene" })}
                onWriteMore={() => {
                  reset();
                  dispatch({ type: "write" });
                }}
                onEnough={reset}
              />
            )}

            {stage === "support" && <SafetyFlow key="support" onQuiet={() => dispatch({ type: "choose_scene", scene: "sand" })} onTopics={openManual} onExit={reset} />}
          </AnimatePresence>
        </main>
        <SiteFooter />
      </motion.div>

      <AnimatePresence>
        {inScene && (
          <SceneHost
            key={state.scene!}
            id={state.scene!}
            input={state.sceneInput}
            topicNote={topicNote}
            onExit={onSceneExit}
            onEditInput={state.scene === "debt" ? () => dispatch({ type: "edit_setup" }) : undefined}
          />
        )}
      </AnimatePresence>
    </>
  );
}
