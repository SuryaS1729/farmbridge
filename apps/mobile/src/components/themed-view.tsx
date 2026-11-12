import { useColorScheme, View, type ViewProps } from "react-native";

import { ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const customBackground = colorScheme === "dark" ? darkColor : lightColor;

  return (
    <View
      style={[
        {
          backgroundColor: type
            ? theme[type]
            : (customBackground ?? theme.background),
        },
        style,
      ]}
      {...otherProps}
    />
  );
}
