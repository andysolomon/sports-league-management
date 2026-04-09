import { useInput, useApp } from "ink";

export interface KeyboardNavHandlers {
  onUp?: () => void;
  onDown?: () => void;
  onSelect?: () => void;
  onBack?: () => void;
  onToggle?: () => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
}

/**
 * Wraps Ink's `useInput` to provide normalized keyboard navigation.
 * - ↑ / k     → onUp
 * - ↓ / j     → onDown
 * - Enter     → onSelect
 * - Escape    → onBack
 * - Space     → onToggle (multi-select)
 * - Ctrl+A    → onSelectAll
 * - Ctrl+D    → onClearAll
 * - q         → exit the app (always, from any screen)
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
    if (input === " ") {
      handlers?.onToggle?.();
      return;
    }
    if (key.ctrl && input === "a") {
      handlers?.onSelectAll?.();
      return;
    }
    if (key.ctrl && input === "d") {
      handlers?.onClearAll?.();
      return;
    }
  });
}
