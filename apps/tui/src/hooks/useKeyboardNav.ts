import { useInput, useApp } from "ink";

export interface KeyboardNavHandlers {
  onUp?: () => void;
  onDown?: () => void;
  onSelect?: () => void;
  onBack?: () => void;
}

/**
 * Wraps Ink's `useInput` to provide normalized keyboard navigation.
 * - ↑ / k → onUp
 * - ↓ / j → onDown
 * - Enter  → onSelect
 * - Escape → onBack
 * - q      → exit the app (always, from any screen)
 */
export function useKeyboardNav(handlers?: KeyboardNavHandlers): void {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }
    if (key.upArrow || input === "k") {
      handlers?.onUp?.();
      return;
    }
    if (key.downArrow || input === "j") {
      handlers?.onDown?.();
      return;
    }
    if (key.return) {
      handlers?.onSelect?.();
      return;
    }
    if (key.escape) {
      handlers?.onBack?.();
      return;
    }
  });
}
