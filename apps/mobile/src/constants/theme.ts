import "@/global.css";

import { Platform } from "react-native";

/** Core palette from the Farmbridge brand guide in Doop. */
export const Palette = {
  bone: "#F2EFE7",
  paper: "#FBFAF6",
  ink: "#15150F",
  muted: "#5E5D50",
  rule: "#D9D5C7",
  accent: "#DCEB3C",
  dark: "#1C2119",
  onDark: "rgba(251, 250, 246, 0.62)",
} as const;

/** Semantic colors used by themed components and screen styles. */
export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.bone,
    backgroundElement: Palette.paper,
    backgroundSelected: Palette.rule,
    textSecondary: Palette.muted,
    ink: Palette.ink,
    paper: Palette.paper,
    muted: Palette.muted,
    border: Palette.rule,
    accent: Palette.accent,
    accentText: Palette.ink,
    darkSurface: Palette.dark,
    onDark: Palette.onDark,
  },
  dark: {
    text: Palette.paper,
    background: Palette.dark,
    backgroundElement: Palette.ink,
    backgroundSelected: Palette.muted,
    textSecondary: Palette.onDark,
    ink: Palette.ink,
    paper: Palette.paper,
    muted: Palette.muted,
    border: Palette.muted,
    accent: Palette.accent,
    accentText: Palette.ink,
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
