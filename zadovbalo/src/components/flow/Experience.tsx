"use client";

import { AnimatePresence } from "motion/react";
import { useCallback, useMemo, useReducer } from "react";
import { StormHero } from "@/components/hero/StormHero";
import { HeroExhale, HeroIntro } from "@/components/hero/HeroCopy";
import { RantInput } from "@/components/input/RantInput";
import { VoiceInput } from "@/components/input/VoiceInput";
import { Analyzing } from "@/components/ai/Analyzing";
import { TopicResults } from "@/components/ai/TopicResults";
import { MechanicRenderer } from "@/components/mechanics/MechanicRenderer";
import { SafetyFlow } from "@/components/safety/SafetyFlow";
import { SiteFooter, SiteHeader } from "@/components/ui/SiteChrome";
import { requestAnalysis } from "@/lib/ai/client";
import { track } from "@/lib/analytics/track";
import { SCENARIOS } from "@/lib/scenarios/registry";
import { sessionLog, startSession } from "@/lib/session/session";
import { ErrorPanel } from "./ErrorPanel";
import { DonePanel, FinishedPanel } from "./Outcome";
import { flowReducer, initialFlow, remainingTopics } from "./state";

export function Experience() {
  const [state, dispatch] = useReducer(flowReducer, initialFlow);
  const { stage } = state;

  const analyze = useCallback(async (text: string, via: "text" | "voice") => {
    dispatch({ type: "analyze" });
    track(via === "voice" ? "input_voice" : "input_text");
    const res = await requestAnalysis(text);
    if (res.status === "safety") return dispatch({ type: "safety" });
    if (res.status === "error") return dispatch({ type: "failed", error: res.error });
    sessionLog.topics(res.result.topics.map((t) => t.category));
    dispatch({ type: "analyzed", result: res.result, caution: res.caution });
  }, []);

  const onTranscript = useCallback((text: string) => dispatch({ type: "transcribed", text }), []);

  const topicLabels = useMemo(() => state.analysis?.result.topics.map((t) => t.label) ?? [], [state.analysis]);
  const scenario = state.active ? SCENARIOS[state.active] : null;

  return (
    <>
      <StormHero scene={stage === "intro" ? "storm" : "calm"} still={stage === "safety"} />
      <SiteHeader />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <main className="safe-px flex flex-1 flex-col items-center justify-center pb-10 pt-24">
          <AnimatePresence mode="wait">
            {stage === "intro" && (
              <HeroIntro
                key="intro"
                onStart={() => {
                  startSession();
                  track("hero_started");
                  dispatch({ type: "start" });
                }}
              />
            )}

            {stage === "exhale" && (
              <HeroExhale key="exhale" onWrite={() => dispatch({ type: "write" })} onDictate={() => dispatch({ type: "dictate" })} />
            )}

            {stage === "write" && (
              <RantInput
                key="write"
                value={state.text}
                onChange={(text) => dispatch({ type: "edit", text })}
                onSubmit={() => void analyze(state.text, state.via)}
                onDictate={() => dispatch({ type: "dictate" })}
              />
            )}

            {stage === "dictate" && <VoiceInput key="dictate" onTranscript={onTranscript} onWrite={() => dispatch({ type: "write" })} />}

            {stage === "analyzing" && <Analyzing key="analyzing" />}

            {stage === "results" && state.analysis && (
              <TopicResults
                key={`results-${state.completed.length}`}
                topics={state.analysis.result.topics}
                completed={state.completed}
                onSelect={(category) => {
                  track("topic_selected", { category });
                  dispatch({ type: "choose", category });
                }}
                onRewrite={() => dispatch({ type: "write" })}
              />
            )}

            {stage === "mechanic" && scenario && state.analysis && (
              <MechanicRenderer
                key={`mechanic-${scenario.category}`}
                scenario={scenario}
                caution={state.analysis.caution}
                topicLabels={topicLabels}
                onComplete={(kept) => dispatch({ type: "completed", kept })}
              />
            )}

            {stage === "done" && scenario && (
              <DonePanel
                key="done"
                doneLine={scenario.copy.done}
                kept={state.kept}
                hasMore={remainingTopics(state).length > 0}
                onMore={() => dispatch({ type: "more" })}
                onEnough={() => {
                  track("session_finished");
                  dispatch({ type: "enough" });
                }}
              />
            )}

            {stage === "finished" && <FinishedPanel key="finished" onRestart={() => dispatch({ type: "restart" })} />}

            {stage === "safety" && <SafetyFlow key="safety" onBack={() => dispatch({ type: "write" })} />}

            {stage === "error" && state.error && (
              <ErrorPanel
                key="error"
                error={state.error}
                onRetry={() => void analyze(state.text, state.via)}
                onEdit={() => dispatch({ type: "write" })}
              />
            )}
          </AnimatePresence>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
