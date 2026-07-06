import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AUTO_ADVANCE_MS,
  getAutoAdvanceIntervalMs,
  scheduleAutoAdvance,
} from "@/components/gamecast/useAutoAdvance";

describe("getAutoAdvanceIntervalMs", () => {
  it("returns 950/speed ms", () => {
    expect(getAutoAdvanceIntervalMs(1)).toBe(AUTO_ADVANCE_MS);
    expect(getAutoAdvanceIntervalMs(2)).toBe(475);
    expect(getAutoAdvanceIntervalMs(0.5)).toBe(1900);
    expect(getAutoAdvanceIntervalMs(4)).toBe(237.5);
  });
});

describe("scheduleAutoAdvance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances one play every 950/speed ms while playing", () => {
    let playIndex = 0;
    const onPlayIndexChange = vi.fn((next: number) => {
      playIndex = next;
    });

    scheduleAutoAdvance({
      playing: true,
      speed: 1,
      getPlayIndex: () => playIndex,
      totalPlays: 5,
      onPlayIndexChange,
    });

    vi.advanceTimersByTime(949);
    expect(onPlayIndexChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onPlayIndexChange).toHaveBeenCalledWith(1);

    vi.advanceTimersByTime(950);
    expect(onPlayIndexChange).toHaveBeenCalledWith(2);
  });

  it("re-paces when speed changes after dispose and reschedule", () => {
    let playIndex = 0;
    const onPlayIndexChange = vi.fn((next: number) => {
      playIndex = next;
    });

    const disposeSlow = scheduleAutoAdvance({
      playing: true,
      speed: 1,
      getPlayIndex: () => playIndex,
      totalPlays: 5,
      onPlayIndexChange,
    });

    vi.advanceTimersByTime(950);
    expect(onPlayIndexChange).toHaveBeenCalledTimes(1);

    disposeSlow();
    onPlayIndexChange.mockClear();

    scheduleAutoAdvance({
      playing: true,
      speed: 2,
      getPlayIndex: () => playIndex,
      totalPlays: 5,
      onPlayIndexChange,
    });

    vi.advanceTimersByTime(474);
    expect(onPlayIndexChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onPlayIndexChange).toHaveBeenCalledWith(2);
  });

  it("stops advancing at final play", () => {
    let playIndex = 4;
    const onPlayIndexChange = vi.fn((next: number) => {
      playIndex = next;
    });
    const onComplete = vi.fn();

    scheduleAutoAdvance({
      playing: true,
      speed: 1,
      getPlayIndex: () => playIndex,
      totalPlays: 5,
      onPlayIndexChange,
      onComplete,
    });

    vi.advanceTimersByTime(950);
    expect(onPlayIndexChange).toHaveBeenCalledTimes(1);
    expect(onPlayIndexChange).toHaveBeenCalledWith(5);
    expect(onComplete).toHaveBeenCalledTimes(1);

    onPlayIndexChange.mockClear();
    vi.advanceTimersByTime(3000);
    expect(onPlayIndexChange).not.toHaveBeenCalled();
  });

  it("does not schedule when not playing", () => {
    const onPlayIndexChange = vi.fn();

    scheduleAutoAdvance({
      playing: false,
      speed: 1,
      getPlayIndex: () => 0,
      totalPlays: 5,
      onPlayIndexChange,
    });

    vi.advanceTimersByTime(5000);
    expect(onPlayIndexChange).not.toHaveBeenCalled();
  });

  it("cleans up on dispose", () => {
    const onPlayIndexChange = vi.fn();

    const dispose = scheduleAutoAdvance({
      playing: true,
      speed: 1,
      getPlayIndex: () => 0,
      totalPlays: 5,
      onPlayIndexChange,
    });

    dispose();
    vi.advanceTimersByTime(5000);
    expect(onPlayIndexChange).not.toHaveBeenCalled();
  });
});
