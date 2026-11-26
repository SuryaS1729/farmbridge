import "@/global.css";

import { Platform } from "react-native";

/** Core palette from the Farmbridge brand guide in Doop. */
export const Palette = {
  bone: "#F2EFE7",
  paper: "#FBFAF6",
  // Halfway between paper and bone: a faint tint for segments inside an input.
  linen: "#F7F5EF",
  ink: "#15150F",
  muted: "#5E5D50",
  rule: "#D9D5C7",
  // Natural moss green; light text sits on it (see accentText).
  accent: "#3E6B3A",
  accentSoftLight: "#DDE7D4",
  accentSoftDark: "#2E3B2A",
  // A brighter leaf green for progress, so it reads at a glance; lighter again on dark.
  progressLight: "#4E9A3F",
  progressDark: "#7DBE5F",
  dark: "#1C2119",
  onDark: "rgba(251, 250, 246, 0.62)",
  // Brick red for errors; the dark-mode pair is lighter so it reads on the dark surface.
  danger: "#9A4237",
  dangerSoftLight: "#FFF0ED",
  dangerOnDark: "#E89A88",
  dangerSoftDark: "#3A2420",
} as const;

/** Semantic colors used by themed components and screen styles. */
export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.bone,
    backgroundElement: Palette.paper,
    backgroundSelected: Palette.rule,
    backgroundSubtle: Palette.linen,
    textSecondary: Palette.muted,
    ink: Palette.ink,
    paper: Palette.paper,
    muted: Palette.muted,
    border: Palette.rule,
    accent: Palette.accent,
    accentText: Palette.paper,
    accentSoft: Palette.accentSoftLight,
    progress: Palette.progressLight,
    danger: Palette.danger,
    dangerSoft: Palette.dangerSoftLight,
    darkSurface: Palette.dark,
    onDark: Palette.onDark,
  },
  dark: {
    text: Palette.paper,
    background: Palette.dark,
    backgroundElement: Palette.ink,
    backgroundSelected: Palette.muted,
    // Halfway between ink (inputs) and the dark page.
    backgroundSubtle: "#191B14",
    textSecondary: Palette.onDark,
    ink: Palette.ink,
    paper: Palette.paper,
    muted: Palette.muted,
    border: Palette.muted,
    accent: Palette.accent,
    accentText: Palette.paper,
    accentSoft: Palette.accentSoftDark,
    progress: Palette.progressDark,
    danger: Palette.dangerOnDark,
    dangerSoft: Palette.dangerSoftDark,
    darkSurface: Palette.dark,
    onDark: Palette.onDark,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Platform fonts already available to the app; custom font files can be added later. */
export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    mono: "ui-monospace",
  },
  android: {
    sans: "sans-serif",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    mono: "var(--font-mono)",
  },
  default: {
    sans: "sans-serif",
    mono: "monospace",
  },
});

/** Named spacing values for new Farmbridge screens. */
export const Space = {
  hairline: 1,
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  page: 24,
  six: 24,
  seven: 32,
  eight: 40,
  nine: 48,
  ten: 64,
  section: 24,
  cardGap: 10,
} as const;

/** Small set of shared corner radii from the brand guide. */
export const Radius = {
  chip: 3,
  control: 6,
  card: 8,
  round: 999,
} as const;

/** Typography scale using local system sans and monospace families. */
export const TypeScale = {
  display: {
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: "700" as const,
  },
  heading: {
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.4,
    fontWeight: "700" as const,
  },
  body: { fontSize: 14, lineHeight: 21, fontWeight: "400" as const },
  bodySmall: { fontSize: 12, lineHeight: 18, fontWeight: "400" as const },
  label: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.1,
    fontWeight: "500" as const,
    textTransform: "uppercase" as const,
  },
  figure: { fontSize: 18, lineHeight: 24, fontWeight: "500" as const },
  price: { fontSize: 40, lineHeight: 44, fontWeight: "500" as const },
} as const;

/** Legacy spacing aliases kept for starter components not yet migrated. */
export const Spacing = {
  half: Space.half,
  one: Space.one,
  two: Space.two,
  three: 16,
  four: Space.page,
  five: Space.seven,
  six: Space.ten,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
