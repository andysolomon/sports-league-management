export const GAMECAST_LAYOUT_STORAGE_KEY = "gamecast:layout";

export const GAMECAST_LAYOUTS = ["broadcast", "field-first", "operator"] as const;

export type GamecastLayout = (typeof GAMECAST_LAYOUTS)[number];

export function isGamecastLayout(value: string): value is GamecastLayout {
  return (GAMECAST_LAYOUTS as readonly string[]).includes(value);
}

/** Invalid or missing stored values fall back to broadcast. */
export function normalizeGamecastLayout(
  value: string | null | undefined,
): GamecastLayout {
  if (value && isGamecastLayout(value)) {
    return value;
  }
  return "broadcast";
}

export const GAMECAST_LAYOUT_LABELS: Record<GamecastLayout, string> = {
  broadcast: "Broadcast",
  "field-first": "Field-first",
  operator: "Operator",
};

const layoutListeners = new Set<() => void>();

export function subscribeGamecastLayout(onStoreChange: () => void): () => void {
  layoutListeners.add(onStoreChange);
  return () => {
    layoutListeners.delete(onStoreChange);
  };
}

export function getGamecastLayoutSnapshot(): GamecastLayout {
  return normalizeGamecastLayout(localStorage.getItem(GAMECAST_LAYOUT_STORAGE_KEY));
}

export function getGamecastLayoutServerSnapshot(): GamecastLayout {
  return "broadcast";
}

export function setGamecastLayout(next: GamecastLayout): void {
  localStorage.setItem(GAMECAST_LAYOUT_STORAGE_KEY, next);
  layoutListeners.forEach((listener) => listener());
}
