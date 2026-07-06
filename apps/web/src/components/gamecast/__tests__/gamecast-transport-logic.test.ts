import { describe, it, expect, vi } from "vitest";
import {
  handleModeChange,
  handlePlayPauseClick,
  isBackTransportDisabled,
  isForwardTransportDisabled,
} from "@/components/gamecast/gamecast-transport-logic";

describe("gamecast transport bounds", () => {
  it("disables back-side controls at playIndex 0", () => {
    expect(isBackTransportDisabled(0)).toBe(true);
    expect(isBackTransportDisabled(1)).toBe(false);
  });

  it("disables forward-side controls at final index", () => {
    expect(isForwardTransportDisabled(10, 10)).toBe(true);
    expect(isForwardTransportDisabled(9, 10)).toBe(false);
  });
});

describe("handlePlayPauseClick", () => {
  it("restarts from 0 and plays when pressed at final", () => {
    const onPlayIndexChange = vi.fn();
    const onPlayingChange = vi.fn();

    handlePlayPauseClick(10, 10, false, onPlayIndexChange, onPlayingChange);

    expect(onPlayIndexChange).toHaveBeenCalledWith(0);
    expect(onPlayingChange).toHaveBeenCalledWith(true);
  });

  it("toggles playing when not at final", () => {
    const onPlayIndexChange = vi.fn();
    const onPlayingChange = vi.fn();

    handlePlayPauseClick(3, 10, false, onPlayIndexChange, onPlayingChange);
    expect(onPlayIndexChange).not.toHaveBeenCalled();
    expect(onPlayingChange).toHaveBeenCalledWith(true);

    onPlayingChange.mockClear();
    handlePlayPauseClick(3, 10, true, onPlayIndexChange, onPlayingChange);
    expect(onPlayingChange).toHaveBeenCalledWith(false);
  });
});

describe("handleModeChange", () => {
  it("pauses before switching mode", () => {
    const onModeChange = vi.fn();
    const onPlayingChange = vi.fn();

    handleModeChange("review", onModeChange, onPlayingChange);

    expect(onPlayingChange).toHaveBeenCalledWith(false);
    expect(onModeChange).toHaveBeenCalledWith("review");
  });
});
