import type { TextInputProps } from "react-native";
import { KeyboardController, KeyboardToolbar } from "react-native-keyboard-controller";

import { Colors, Space } from "@/constants/theme";

// Height of the library's KeyboardToolbar, so fields scroll clear of it as well as the keyboard.
const KEYBOARD_TOOLBAR_HEIGHT = 42;

/**
 * bottomOffset for a KeyboardAwareScrollView paired with FormKeyboardToolbar: room for the
 * toolbar plus a one-line hint under the focused input.
 */
export const FORM_KEYBOARD_BOTTOM_OFFSET = KEYBOARD_TOOLBAR_HEIGHT + Space.seven;

const theme = {
  light: {
    primary: Colors.light.accent,
    disabled: Colors.light.border,
    background: Colors.light.backgroundElement,
    ripple: Colors.light.accentSoft,
  },
  dark: {
    primary: Colors.dark.text,
    disabled: Colors.dark.border,
    background: Colors.dark.backgroundElement,
    ripple: Colors.dark.accentSoft,
  },
};

/**
 * Prev / Next / Done above the keyboard, in the app's colours. Number pads have no key to
 * move to the next field, so multi-field forms render this after their scroll view.
 */
export function FormKeyboardToolbar() {
  return <KeyboardToolbar theme={theme} />;
}

/**
 * Props for what a text input's enter (tick) key does: "next" moves to the next field and keeps
 * the keyboard open; "done" closes it. Use "done" on the last field of a form or step.
 */
export function enterKeyProps(
  action: "next" | "done",
): Pick<TextInputProps, "returnKeyType" | "submitBehavior" | "onSubmitEditing"> {
  return action === "next"
    ? { returnKeyType: "next", submitBehavior: "submit", onSubmitEditing: () => KeyboardController.setFocusTo("next") }
    : { returnKeyType: "done", submitBehavior: "blurAndSubmit" };
}
