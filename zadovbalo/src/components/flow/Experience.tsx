"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { StormHero } from "@/components/hero/StormHero";
import { HeroFirst } from "@/components/hero/HeroCopy";
import { RantInput } from "@/components/input/RantInput";
import { VoiceInput } from "@/components/input/VoiceInput";
import { Analyzing } from "@/components/ai/Analyzing";
import { SceneHost } from "@/components/scenes/SceneHost";
import { SafetyFlow } from "@/components/safety/SafetyFlow";
import { SiteFooter, SiteHeader } from "@/components/ui/SiteChrome";
import { createAnalyzer } from "@/lib/ai/client";
import { track } from "@/lib/analytics/track";
import { splitPhrases } from "@/lib/text";
import { Clarify, Confirm, Finish, Manual, WarChoice } from "./Choices";
import { DebtSetup, LabelsSetup } from "./Setup";
import { flowReducer, initialFlow } from "./state";

const STICKER_EXAMPLES = ["«Не драматизуй»", "«Тобі здалося»", "«Ти перебільшуєш»", "«Це ж дрібниці»", "«Можна було й краще»", "«Знову ти зі своїм»"];
const BACKPACK_EXAMPLES = ["Робота", "Дім", "Рахунки", "Діти", "Навчання", "Здоровʼя"];

export function Experience() {
  const [state, dispatch] = useReducer(flowReducer, initialFlow);
  const analyzer = useRef(createAnalyzer());
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

  const analyze = useCallback(async (text: string) => {
    dispatch({ type: "analyze" });
    track("text_submitted");
    const res = await analyzer.current.analyze(text);
    switch (res.status) {
      case "stale":
        return; // відповідь запізнилась: людина вже скасувала чи почала заново
      case "ok":
        return dispatch({ type: "analyzed", analysis: res.analysis });
      case "support":
        return dispatch({ type: "support" });
      case "manual":
        track("manual_choice_opened");
        return dispatch({ type: "manual", reason: res.reason, keywordSuggestions: res.keywordSuggestions, amount: res.amount, currency: res.currency });
      case "invalid_input":
        return dispatch({ type: "write" });
    }
  }, []);

  const reset = () => {
    analyzer.current.cancel();
    dispatch({ type: "reset" });
  };

  const openManual = () => {
    leaveHero();
    track("manual_choice_opened");
    dispatch({ type: "manual", reason: null });
  };

  const onTranscript = useCallback((text: string) => dispatch({ type: "transcribed", text }), []);
  const inScene = stage === "scene" && state.scene;

  return (
    <>
      <StormHero scene={stage === "hero" ? "storm" : "calm"} still={stage === "support" || Boolean(inScene)} />
      <SiteHeader />

      <div className="relative z-10 flex min-h-dvh flex-col" aria-hidden={inScene ? true : undefined} inert={inScene ? true : undefined}>
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

            {stage === "confirm" && state.analysis && state.category && (
              <Confirm
                key="confirm"
                analysis={state.analysis}
                category={state.category}
                onCategory={(category) => dispatch({ type: "choose_category", category })}
                onScene={(scene) => dispatch({ type: "choose_scene", scene })}
                onOther={openManual}
              />
            )}

            {stage === "confirm" && !state.analysis && state.category && (
              // Тема обрана вручну — показуємо дії без «схоже, що…».
              <Confirm
                key={`confirm-manual-${state.category}`}
                detected={false}
                analysis={{ categories: [state.category], primaryCategory: state.category, emotion: null, needsClarification: false, amount: null, currency: null, sceneIds: [] }}
                category={state.category}
                onCategory={(category) => dispatch({ type: "choose_category", category })}
                onScene={(scene) => dispatch({ type: "choose_scene", scene })}
                onOther={openManual}
              />
            )}

            {stage === "clarify" && state.analysis && (
              <Clarify key="clarify" categories={state.analysis.categories} onCategory={(category) => dispatch({ type: "choose_category", category })} onOther={openManual} />
            )}

            {stage === "manual" && (
              <Manual
                key="manual"
                reason={state.manualReason}
                suggestions={state.keywordSuggestions}
                onCategory={(category) => dispatch({ type: "choose_category", category })}
                onSupport={() => dispatch({ type: "support" })}
              />
            )}

            {stage === "war_choice" && (
              <WarChoice key="war" onAnger={() => dispatch({ type: "choose_scene", scene: "war_map" })} onQuiet={() => dispatch({ type: "choose_scene", scene: "sand" })} />
            )}

            {stage === "setup" && state.scene === "debt" && (
              <DebtSetup
                key="setup-debt"
                amount={state.extracted.amount}
                currency={state.extracted.currency}
                onDone={(amount, currency) => dispatch({ type: "setup_done", input: { amount, currency } })}
                onBack={() => dispatch({ type: "change_action" })}
              />
            )}
            {stage === "setup" && state.scene === "backpack" && (
              <LabelsSetup
                key="setup-backpack"
                title="Що в рюкзаку?"
                intro="Короткі назви справ. Можна змінити, прибрати чи додати."
                initial={splitPhrases(state.text)}
                examples={BACKPACK_EXAMPLES}
                onDone={(labels) => dispatch({ type: "setup_done", input: { labels } })}
                onBack={() => dispatch({ type: "change_action" })}
              />
            )}
            {stage === "setup" && state.scene === "stickers" && (
              <LabelsSetup
                key="setup-stickers"
                title="Які слова липнуть?"
                intro="Напиши фрази, що досі чіпляються, або обери з прикладів. Нічого не додамо без твого вибору."
                initial={[]}
                examples={STICKER_EXAMPLES}
                onDone={(labels) => dispatch({ type: "setup_done", input: { labels } })}
                onBack={() => dispatch({ type: "change_action" })}
              />
            )}

            {stage === "finish" && (
              <Finish
                key="finish"
                onOther={() => dispatch({ type: "change_action" })}
                onWriteMore={() => {
                  reset();
                  dispatch({ type: "write" });
                }}
                onEnough={reset}
              />
            )}

            {stage === "support" && (
              <SafetyFlow key="support" onQuiet={() => dispatch({ type: "choose_scene", scene: "sand" })} onTopics={openManual} onExit={reset} />
            )}
          </AnimatePresence>
        </main>
        <SiteFooter />
      </div>

      {inScene && (
        <SceneHost
          id={state.scene!}
          input={state.sceneInput}
          onChangeAction={() => dispatch({ type: "change_action" })}
          onFinish={() => {
            track("scene_finished");
            dispatch({ type: "finish_scene" });
          }}
        />
      )}
    </>
  );
}
