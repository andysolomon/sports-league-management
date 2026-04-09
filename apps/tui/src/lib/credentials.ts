import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getAuthFilePath } from "./config.js";

export interface StoredCredentials {
  apiKey: string;
  userId: string;
  email: string | null;
  createdAt: string;
}

export async function writeCredentials(
  creds: StoredCredentials,
): Promise<string> {
  const path = getAuthFilePath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(creds, null, 2) + "\n", {
    mode: 0o600,
  });
  return path;
}

export async function readCredentials(): Promise<StoredCredentials | null> {
  try {
    const raw = await readFile(getAuthFilePath(), "utf8");
    return JSON.parse(raw) as StoredCredentials;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
