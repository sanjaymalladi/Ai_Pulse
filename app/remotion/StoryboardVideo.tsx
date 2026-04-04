import React from "react";
import { Audio, Sequence, useVideoConfig } from "remotion";
import { AmbientTransitionBridge } from "./templates/AmbientTransitionBridge";
import { DiagramFlow } from "./templates/DiagramFlow";
import { HeroLogoStatement } from "./templates/HeroLogoStatement";
import { ImageCardFocus } from "./templates/ImageCardFocus";
import { KineticTypography } from "./templates/KineticTypography";
import { QuoteReveal } from "./templates/QuoteReveal";
import { StatCompare } from "./templates/StatCompare";
import type { ScenePlan, TimingWord, VideoPlan } from "@/app/lib/videoPlan/types";

function renderScene(scene: ScenePlan, videoPlan: VideoPlan) {
  switch (scene.template) {
    case "hero_logo_statement":
      return <HeroLogoStatement scene={scene} palette={videoPlan.globalAssets.palette} />;
    case "image_card_focus":
      return <ImageCardFocus scene={scene} palette={videoPlan.globalAssets.palette} />;
    case "stat_compare":
      return <StatCompare scene={scene} palette={videoPlan.globalAssets.palette} />;
    case "quote_reveal":
      return <QuoteReveal scene={scene} palette={videoPlan.globalAssets.palette} />;
    case "diagram_flow":
      return <DiagramFlow scene={scene} palette={videoPlan.globalAssets.palette} />;
    case "ambient_transition_bridge":
      return <AmbientTransitionBridge scene={scene} palette={videoPlan.globalAssets.palette} />;
    case "kinetic_typography":
    default:
      return <KineticTypography scene={scene} palette={videoPlan.globalAssets.palette} />;
  }
}

function wrapFirstScene(sceneNode: React.ReactNode, enabled: boolean) {
  if (!enabled) return sceneNode;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "translateY(-120px) scale(0.78)",
          transformOrigin: "top center",
        }}
      >
        {sceneNode}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "46%",
          background: "linear-gradient(180deg, rgba(5,8,22,0.04), rgba(5,8,22,0.22) 35%, rgba(5,8,22,0.72) 100%)",
          borderTop: "1px solid rgba(148,163,184,0.14)",
        }}
      />
    </div>
  );
}

export default function StoryboardVideo({
  videoPlan,
  audioTrackUrl,
}: {
  videoPlan: VideoPlan;
  timings?: TimingWord[] | null;
  audioTrackUrl?: string | null;
}) {
  const { fps } = useVideoConfig();

  return (
    <div style={{ width: "100%", height: "100%", background: "#050816" }}>
      {audioTrackUrl ? <Audio src={audioTrackUrl} /> : null}
      {videoPlan.scenes.map((scene, index) => {
        const from = Math.max(0, Math.floor(scene.startSec * fps));
        const durationInFrames = Math.max(8, Math.ceil((scene.endSec - scene.startSec) * fps));
        return (
          <Sequence key={scene.sceneId} from={from} durationInFrames={durationInFrames}>
            {wrapFirstScene(renderScene(scene, videoPlan), index === 0)}
          </Sequence>
        );
      })}
    </div>
  );
}
