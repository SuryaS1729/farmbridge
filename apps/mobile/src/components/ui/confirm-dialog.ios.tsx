import { Alert, Button, Host, Text } from "@expo/ui/swift-ui";
import { StyleSheet } from "react-native";

import type { ConfirmDialogProps } from "./confirm-dialog.types";

/** A native SwiftUI alert asking the farmer to confirm an action. */
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
  return (
    // The alert presents over the whole screen; its host takes no space in the layout.
    <Host style={styles.host} pointerEvents="none">
      <Alert
        title={title}
        isPresented={visible}
        // SwiftUI closes the alert itself after any button, so closing is handled once, here.
        onIsPresentedChange={(presented) => {
          if (!presented) onClose();
        }}
      >
        <Alert.Trigger>
          <Text>{""}</Text>
        </Alert.Trigger>
        <Alert.Actions>
          {cancelLabel ? <Button role="cancel" label={cancelLabel} /> : null}
          <Button role={destructive ? "destructive" : "default"} label={confirmLabel} onPress={onConfirm} />
        </Alert.Actions>
        {message ? (
          <Alert.Message>
            <Text>{message}</Text>
          </Alert.Message>
        ) : null}
      </Alert>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", width: 0, height: 0 },
});
