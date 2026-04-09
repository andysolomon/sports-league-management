import { describe, it, expect } from "vitest";
import { useMultiSelect } from "../hooks/useMultiSelect.js";

// Test the hook's logic directly by simulating React state
// Since this is a pure state hook, we can test the returned functions
// by calling the hook outside React (Vitest runs in Node, not a component tree)
// Instead, test via the screens that consume it — see leagues-screen.test.tsx

// For unit coverage of the hook logic, test the state transitions:
describe("useMultiSelect (logic)", () => {
  it("exports a function", () => {
    expect(typeof useMultiSelect).toBe("function");
  });

  // The detailed behavior tests are in leagues-screen.test.tsx
  // and teams-screen.test.tsx where the hook is used in a real
  // Ink component tree with ink-testing-library's render().
});
