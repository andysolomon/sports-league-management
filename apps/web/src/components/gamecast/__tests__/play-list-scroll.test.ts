import { describe, it, expect } from "vitest";
import {
  computePlayListScrollTop,
  shouldFollowCurrentPlay,
} from "@/components/gamecast/play-list-scroll";

describe("shouldFollowCurrentPlay", () => {
  it("follows during playback in review mode", () => {
    // The reported bug: pressing play advanced the highlight but the list
    // never moved, so the current play scrolled out of view.
    expect(shouldFollowCurrentPlay("review", true)).toBe(true);
  });

  it("does not follow a manual selection while paused in review mode", () => {
    expect(shouldFollowCurrentPlay("review", false)).toBe(false);
  });

  it("always follows in sim mode", () => {
    expect(shouldFollowCurrentPlay("sim", false)).toBe(true);
    expect(shouldFollowCurrentPlay("sim", true)).toBe(true);
  });
});

describe("computePlayListScrollTop", () => {
  const clientHeight = 100;

  it("returns null when the row intersects the visible band", () => {
    expect(computePlayListScrollTop(50, clientHeight, 60, 20)).toBeNull();
    expect(computePlayListScrollTop(0, clientHeight, 0, 20)).toBeNull();
    expect(computePlayListScrollTop(80, clientHeight, 90, 20)).toBeNull();
  });

  it("scrolls up when the row is entirely above the viewport", () => {
    expect(computePlayListScrollTop(100, clientHeight, 10, 20)).toBe(10);
  });

  it("scrolls down when the row is entirely below the viewport", () => {
    expect(computePlayListScrollTop(0, clientHeight, 150, 20)).toBe(70);
  });
});
