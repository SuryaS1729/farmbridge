import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { Fonts, ThemeColor, TypeScale } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "small"
    | "smallBold"
    | "subtitle"
    | "link"
    | "linkPrimary"
    | "code"
    | "label"
    | "figure"
    | "price";
  themeColor?: ThemeColor;
};

export function ThemedText({
  style,
  type = "default",
  themeColor,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? "text"] },
        styles.base,
        type === "default" && styles.default,
        type === "title" && styles.title,
        type === "small" && styles.small,
        type === "smallBold" && styles.smallBold,
        type === "subtitle" && styles.subtitle,
        type === "link" && styles.link,
        type === "linkPrimary" && styles.linkPrimary,
        type === "code" && styles.code,
        type === "label" && styles.label,
        type === "figure" && styles.figure,
        type === "price" && styles.price,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Fonts?.sans,
  },
  small: {
    ...TypeScale.bodySmall,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  default: {
    ...TypeScale.body,
  },
  title: {
    ...TypeScale.display,
  },
  subtitle: {
    ...TypeScale.heading,
  },
  link: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  linkPrimary: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
  label: {
    ...TypeScale.label,
    fontFamily: Fonts?.mono,
  },
  figure: {
    ...TypeScale.figure,
    fontFamily: Fonts?.mono,
  },
  price: {
    ...TypeScale.price,
    fontFamily: Fonts?.mono,
  },
});
