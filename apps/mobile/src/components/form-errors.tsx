import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { StyleSheet, View, type ScrollView } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Radius, Space } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/** One message per field that failed validation, keyed by field name. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function hasErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}

/** A field's problem, shown in red right under the field it is about. */
export function FieldError({ message }: { message?: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <ThemedText
      type="small"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ color: theme.danger }}
    >
      {message}
    </ThemedText>
  );
}

/**
 * A problem with the whole form, such as the server refusing it or no connection.
 * Place it right above the button the farmer just pressed, so they see it.
 */
export function FormError({ message }: { message?: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: theme.dangerSoft, borderLeftColor: theme.danger }]}
    >
      <ThemedText type="small" style={{ color: theme.danger }}>
        {message}
      </ThemedText>
    </View>
  );
}

/**
 * Scrolls a form's ScrollView to its first invalid field, so a farmer who taps
 * Review at the bottom of a long form sees what to fix.
 *
 * Give each field's wrapping View `ref={fieldRef("name")}`, then call
 * `scrollToFirst(errors)` with errors in on-screen order.
 */
export function useScrollToField(scrollRef: RefObject<ScrollView | null>) {
  const fields = useRef(new Map<string, View | null>());
  const callbacks = useRef(new Map<string, (node: View | null) => void>());
  // Scroll after the error messages have rendered, since they move the fields below them.
  const [target, setTarget] = useState<{ key: string } | null>(null);

  const fieldRef = useCallback((key: string) => {
    let callback = callbacks.current.get(key);
    if (!callback) {
      callback = (node: View | null) => {
        fields.current.set(key, node);
      };
      callbacks.current.set(key, callback);
    }
    return callback;
  }, []);

  const scrollToFirst = useCallback((errors: Record<string, string | undefined>) => {
    const key = Object.keys(errors).find((name) => errors[name]);
    if (key) setTarget({ key });
  }, []);

  useEffect(() => {
    if (!target) return;
    const field = fields.current.get(target.key);
    const scroll = scrollRef.current;
    const content = scroll?.getInnerViewRef();
    if (!field || !scroll || !content) return;
    field.measureLayout(content, (_x, y) => {
      scroll.scrollTo({ y: Math.max(0, y - Space.six), animated: true });
    });
  }, [target, scrollRef]);

  return { fieldRef, scrollToFirst };
}

const styles = StyleSheet.create({
  banner: {
    borderLeftWidth: 3,
    borderRadius: Radius.control,
    paddingHorizontal: Space.three,
    paddingVertical: Space.two,
  },
});
