import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_API_URL = "https://sprtsmng.andrewsolomon.dev";

export function getApiBaseUrl(): string {
  return process.env.SPRTSMNG_API_URL ?? DEFAULT_API_URL;
}

export function getAuthFilePath(): string {
  const xdgConfigHome =
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdgConfigHome, "sprtsmng", "auth.json");
}
