import { AlertDialog, Host, Text, TextButton } from "@expo/ui/jetpack-compose";
import { StyleSheet } from "react-native";

import { Palette } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useTheme } from "@/hooks/use-theme";

import type { ConfirmDialogProps } from "./confirm-dialog.types";

/** A native Material 3 dialog asking the farmer to confirm an action. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  if (!visible) return null;

  return (
    // The dialog presents over the whole screen; its host takes no space in the layout.
    // Seeding Material's colours from the brand green keeps the buttons on-brand.
    <Host
      style={styles.host}
      colorScheme={scheme === "dark" ? "dark" : "light"}
      seedColor={Palette.accent}
    >
      <AlertDialog onDismissRequest={onClose}>
        <AlertDialog.Title>
          <Text>{title}</Text>
        </AlertDialog.Title>
        {message ? (
          <AlertDialog.Text>
            <Text>{message}</Text>
          </AlertDialog.Text>
        ) : null}
        <AlertDialog.ConfirmButton>
          <TextButton
            onClick={() => {
              onClose();
              onConfirm?.();
            }}
          >
            <Text color={destructive ? theme.danger : undefined}>{confirmLabel}</Text>
          </TextButton>
        </AlertDialog.ConfirmButton>
        {cancelLabel ? (
          <AlertDialog.DismissButton>
            <TextButton onClick={onClose}>
              <Text>{cancelLabel}</Text>
            </TextButton>
          </AlertDialog.DismissButton>
        ) : null}
      </AlertDialog>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", width: 0, height: 0 },
});
