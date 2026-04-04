import React from "react";
import { Composition } from "remotion";
import StoryboardVideo from "./StoryboardVideo";
import type { VideoPlan } from "@/app/lib/videoPlan/types";

const EMPTY_PLAN: VideoPlan = {
  version: 1,
  meta: {
    title: "Storyboard Export",
    durationSec: 10,
    stylePack: "tech-news-bold",
    aspectRatio: "9:16",
  },
  globalAssets: {
    palette: ["#f6f1e8", "#0f172a", "#f59e0b", "#38bdf8", "#ec4899"],
    textureMode: "soft-noise",
  },
  scenes: [],
};

export const REMOTION_COMPOSITION_ID = "StoryboardExport";

export function RenderRoot() {
  return (
    <Composition
      id={REMOTION_COMPOSITION_ID}
      component={StoryboardVideo}
      durationInFrames={330}
      calculateMetadata={({ props }) => {
        const durationSec =
          props.videoPlan && typeof props.videoPlan.meta?.durationSec === "number"
            ? props.videoPlan.meta.durationSec
            : EMPTY_PLAN.meta.durationSec;

        return {
          durationInFrames: Math.max(330, Math.ceil((durationSec + 1) * 30)),
        };
      }}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        videoPlan: EMPTY_PLAN,
        audioTrackUrl: null,
      }}
    />
  );
}
