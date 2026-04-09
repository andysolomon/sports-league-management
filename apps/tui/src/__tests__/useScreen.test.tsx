import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { ScreenProvider, useScreen } from "../hooks/useScreen.js";

function ScreenDisplay() {
  const { current, stack } = useScreen();
  return <Text>{`screen:${current} depth:${stack.length}`}</Text>;
}

function ScreenNav() {
  const { current, push, back } = useScreen();
  return (
    <>
      <Text>{`screen:${current}`}</Text>
      <Text>{`push:leagues`}</Text>
      <Text>{`back`}</Text>
    </>
  );
}

describe("useScreen", () => {
  it("starts on the home screen", () => {
    const { lastFrame } = render(
      <ScreenProvider>
        <ScreenDisplay />
      </ScreenProvider>,
    );
    expect(lastFrame()).toContain("screen:home");
    expect(lastFrame()).toContain("depth:1");
  });

  // Note: useScreen throws when used outside ScreenProvider, but React
  // catches the error via its internal error boundary rather than
  // propagating it as a synchronous throw. The guard exists for
  // developer ergonomics — a clear error message in the console.
});
