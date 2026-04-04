import type { SceneTemplate } from "./types";

export const TEMPLATE_CATALOG: Array<{
  id: SceneTemplate;
  label: string;
  purpose: string;
  prefersAssets: boolean;
}> = [
  { id: "hero_logo_statement", label: "Hero Logo Statement", purpose: "Brand-forward announcement with headline and logo emphasis.", prefersAssets: true },
  { id: "kinetic_typography", label: "Kinetic Typography", purpose: "Short, high-energy text-driven hook or punchline.", prefersAssets: false },
  { id: "image_card_focus", label: "Image Card Focus", purpose: "Single hero image or clip with annotation overlays.", prefersAssets: true },
  { id: "stat_compare", label: "Stat Compare", purpose: "Comparison, benchmark, pricing, or metric-led explanation.", prefersAssets: false },
  { id: "quote_reveal", label: "Quote Reveal", purpose: "Key quote or argument split into reveal beats.", prefersAssets: false },
  { id: "diagram_flow", label: "Diagram Flow", purpose: "Process explanation using nodes, arrows, and structured layouts.", prefersAssets: false },
  { id: "ambient_transition_bridge", label: "Ambient Transition Bridge", purpose: "Abstract bridge scene when visual context is thin.", prefersAssets: false },
];

export const DEFAULT_TEMPLATE_SEQUENCE: SceneTemplate[] = [
  "kinetic_typography",
  "hero_logo_statement",
  "image_card_focus",
  "stat_compare",
  "quote_reveal",
  "diagram_flow",
  "ambient_transition_bridge",
];
