import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useKeyboardNav } from "../hooks/useKeyboardNav.js";

function TestComponent({
  onUp,
  onDown,
  onSelect,
  onBack,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onSelect?: () => void;
  onBack?: () => void;
}) {
  useKeyboardNav({ onUp, onDown, onSelect, onBack });
  return <Text>nav test</Text>;
}

describe("useKeyboardNav", () => {
  it("calls onUp when k is pressed", () => {
    const onUp = vi.fn();
    const { stdin } = render(<TestComponent onUp={onUp} />);
    stdin.write("k");
    expect(onUp).toHaveBeenCalledOnce();
  });

  it("calls onDown when j is pressed", () => {
    const onDown = vi.fn();
    const { stdin } = render(<TestComponent onDown={onDown} />);
    stdin.write("j");
    expect(onDown).toHaveBeenCalledOnce();
  });

  it("calls onUp on up arrow", () => {
    const onUp = vi.fn();
    const { stdin } = render(<TestComponent onUp={onUp} />);
    stdin.write("\x1B[A"); // up arrow escape sequence
    expect(onUp).toHaveBeenCalledOnce();
  });

  it("calls onDown on down arrow", () => {
    const onDown = vi.fn();
    const { stdin } = render(<TestComponent onDown={onDown} />);
    stdin.write("\x1B[B"); // down arrow escape sequence
    expect(onDown).toHaveBeenCalledOnce();
  });

  it("calls onSelect on enter", () => {
    const onSelect = vi.fn();
    const { stdin } = render(<TestComponent onSelect={onSelect} />);
    stdin.write("\r"); // carriage return = enter
    expect(onSelect).toHaveBeenCalledOnce();
  });

  // Note: bare \x1B (escape) is ambiguous in terminal emulators — Ink's
  // test library buffers it as a potential start of a multi-byte escape
  // sequence (like arrow keys \x1B[A). Escape handling is verified
  // manually rather than via stdin.write in tests.

  it("does not throw when no handlers are provided", () => {
    const { stdin } = render(<TestComponent />);
    expect(() => {
      stdin.write("j");
      stdin.write("k");
      stdin.write("\r");
      stdin.write("\x1B");
    }).not.toThrow();
  });
});
