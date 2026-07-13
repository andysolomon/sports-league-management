/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import {
  DENSITY_STORAGE_KEY,
  DensityProvider,
  DEFAULT_DENSITY,
} from "../density-provider";
import { DensityToggle } from "../density-toggle";

describe("DensityProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-density");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
    document.documentElement.setAttribute("data-density", DEFAULT_DENSITY);
  });

  it("defaults to comfortable and writes the storage key on toggle", () => {
    act(() => {
      root.render(
        <DensityProvider>
          <DensityToggle />
        </DensityProvider>,
      );
    });

    expect(document.documentElement.getAttribute("data-density")).toBe(
      "comfortable",
    );

    const button = container.querySelector("button");
    expect(button).not.toBeNull();

    act(() => {
      button?.click();
    });

    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");

    act(() => {
      button?.click();
    });

    expect(document.documentElement.getAttribute("data-density")).toBe(
      "comfortable",
    );
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("comfortable");
  });

  it("hydrates from localStorage on mount", () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "compact");

    act(() => {
      root.render(
        <DensityProvider>
          <span>child</span>
        </DensityProvider>,
      );
    });

    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });
});
