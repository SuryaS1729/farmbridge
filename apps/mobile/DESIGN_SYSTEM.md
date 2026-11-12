# Farmbridge mobile design system

The Farmer app follows the agricultural-ledger direction in the Farmer app page of the Doop canvas, `Surya's first canvas`. This code version uses the palette and spacing from its `brand-system` guide. It uses fonts already available on each platform; Archivo and IBM Plex Mono can be added later if the app bundles those font files.

## Foundations

Use the exported tokens in `src/constants/theme.ts` instead of adding color, spacing, or radius literals to new screens.

| Role                      | Token            | Value     |
| ------------------------- | ---------------- | --------- |
| Page background           | `Palette.bone`   | `#F2EFE7` |
| Card and input surface    | `Palette.paper`  | `#FBFAF6` |
| Main text                 | `Palette.ink`    | `#15150F` |
| Secondary text            | `Palette.muted`  | `#5E5D50` |
| Border and divider        | `Palette.rule`   | `#D9D5C7` |
| Main action and highlight | `Palette.accent` | `#DCEB3C` |
| Dark surface              | `Palette.dark`   | `#1C2119` |

`Space` provides the named scale. Use `Space.page` for the 24px screen inset, `Space.two` for compact 8px gaps, and `Space.section` between larger sections. `Radius` provides 3px chips, 6px controls, and 8px cards.

`Fonts` selects the local system sans and monospace fonts. `TypeScale` and `ThemedText` provide shared sizes for headings, body copy, labels, and figures. Labels and figures use the platform monospace family to echo the Doop layouts without fetching fonts at runtime.

## Components

- `ThemedView` is a React Native `View` with a theme-aware background. Pass `style` for layout or other custom styling; those styles are applied after its default background. Use `type` to choose a semantic theme color, or `lightColor` and `darkColor` for a local background override.
- `ThemedText` applies the shared text color and type scale. Its `style` prop can customize or override the shared style.
- `Card` provides paper or dark surfaces with the shared border and radius.
- `Button` provides accent, ink, and outline variants, plus disabled and loading states.

Prefer these components and tokens for new screens. Add a new token when the value has a repeated design role; keep one-off layout adjustments in the screen's `StyleSheet`.

## Current screen scope

The sign-in, farmer Home, and Learn screens use the Farmer app palette. Home content stays limited to the available authenticated account data. Learn lists the planned crop-advisory and post-harvest topics; video playback and content management are not connected yet. The buying desk page in Doop is a separate admin surface and is not part of the mobile Farmer app system.
