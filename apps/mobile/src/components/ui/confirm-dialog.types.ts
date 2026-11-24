export type ConfirmDialogProps = {
  /** Shows the dialog while true. */
  visible: boolean;
  title: string;
  message?: string;
  /** The button that goes ahead, e.g. "Discard", or "OK" for a plain notice. */
  confirmLabel: string;
  /** The button that backs out, e.g. "Keep editing". Leave it out for a one-button notice. */
  cancelLabel?: string;
  /** Shows the confirm button in red, for actions that lose something. */
  destructive?: boolean;
  /** Called on confirm only, after `onClose`. */
  onConfirm?: () => void;
  /** Called whenever the dialog goes away: either button, or tapping outside on Android. */
  onClose: () => void;
};
