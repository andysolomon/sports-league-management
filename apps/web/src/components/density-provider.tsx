"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const DENSITY_STORAGE_KEY = "sports-mgmt-density";

export type Density = "comfortable" | "compact";

export const DEFAULT_DENSITY: Density = "comfortable";

function readStoredDensity(): Density {
  if (typeof window === "undefined") return DEFAULT_DENSITY;
  try {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    return stored === "compact" ? "compact" : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

function applyDensity(density: Density) {
  document.documentElement.setAttribute("data-density", density);
}

interface DensityContextValue {
  density: Density;
  setDensity: (density: Density) => void;
  toggleDensity: () => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

/**
 * Device-scoped UI density (WSM-000244). Pairs with a pre-hydration inline
 * script on <html> so the first paint matches the stored preference.
 */
export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<Density>(readStoredDensity);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // Private browsing — still apply for the session.
    }
    applyDensity(next);
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === "compact" ? "comfortable" : "compact");
  }, [density, setDensity]);

  useEffect(() => {
    applyDensity(density);
  }, [density]);

  const value = useMemo(
    () => ({ density, setDensity, toggleDensity }),
    [density, setDensity, toggleDensity],
  );

  return (
    <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    throw new Error("useDensity must be used within DensityProvider");
  }
  return ctx;
}
