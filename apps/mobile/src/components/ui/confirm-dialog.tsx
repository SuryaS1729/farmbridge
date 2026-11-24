import { useEffect } from "react";

import type { ConfirmDialogProps } from "./confirm-dialog.types";

/** Web: the browser's own confirm box. iOS and Android use native dialogs (see the .ios/.android files). */
export function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!visible) return;
    const text = message ? `${title}\n\n${message}` : title;
    // A one-button notice is a plain alert; otherwise ask OK / Cancel.
    const confirmed = cancelLabel ? window.confirm(text) : (window.alert(text), true);
    onClose();
    if (confirmed) onConfirm?.();
    // Runs once each time the dialog is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return null;
}
