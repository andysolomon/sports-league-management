"use client";

import { useEffect, useState } from "react";
import { LocalWorkspaceProvider } from "./local-workspace-provider";

/**
 * Client hook returning the browser-local workspace provider, or `null` until the
 * component has mounted. The provider is constructed in an effect — NEVER during
 * render — because it opens IndexedDB, which does not exist during server-side
 * rendering. Callers gate their data loads on a non-null provider.
 */
export function useLocalProvider(): LocalWorkspaceProvider | null {
  const [provider, setProvider] = useState<LocalWorkspaceProvider | null>(null);
  useEffect(() => {
    setProvider(new LocalWorkspaceProvider());
  }, []);
  return provider;
}
