import { describe, it, expect, afterEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { getApiBaseUrl, getAuthFilePath } from "../lib/config.js";

describe("getApiBaseUrl", () => {
  const original = process.env.SPRTSMNG_API_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SPRTSMNG_API_URL;
    } else {
      process.env.SPRTSMNG_API_URL = original;
    }
  });

  it("returns the production default when SPRTSMNG_API_URL is unset", () => {
    delete process.env.SPRTSMNG_API_URL;
    expect(getApiBaseUrl()).toBe("https://sprtsmng.andrewsolomon.dev");
  });

  it("returns the env var when set", () => {
    process.env.SPRTSMNG_API_URL = "http://localhost:3002";
    expect(getApiBaseUrl()).toBe("http://localhost:3002");
  });
});

describe("getAuthFilePath", () => {
  const originalXdg = process.env.XDG_CONFIG_HOME;

  afterEach(() => {
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
  });

  it("uses $HOME/.config/sprtsmng/auth.json when XDG_CONFIG_HOME is unset", () => {
    delete process.env.XDG_CONFIG_HOME;
    expect(getAuthFilePath()).toBe(
      join(homedir(), ".config", "sprtsmng", "auth.json"),
    );
  });

  it("uses $XDG_CONFIG_HOME/sprtsmng/auth.json when set", () => {
    process.env.XDG_CONFIG_HOME = "/tmp/test-xdg";
    expect(getAuthFilePath()).toBe("/tmp/test-xdg/sprtsmng/auth.json");
  });
});
