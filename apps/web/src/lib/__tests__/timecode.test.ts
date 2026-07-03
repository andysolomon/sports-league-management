import { describe, it, expect } from "vitest";
import { parseTimecode, formatTimecode } from "../timecode";

describe("parseTimecode", () => {
  it("parses bare seconds", () => {
    expect(parseTimecode("45")).toBe(45);
  });

  it("parses mm:ss", () => {
    expect(parseTimecode("12:05")).toBe(725);
  });

  it("parses hh:mm:ss", () => {
    expect(parseTimecode("1:02:03")).toBe(3723);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseTimecode("  2:30 ")).toBe(150);
  });

  it("rejects empty, malformed, and out-of-base-60 segments", () => {
    expect(parseTimecode("")).toBeNull();
    expect(parseTimecode("abc")).toBeNull();
    expect(parseTimecode("1:2:3:4")).toBeNull();
    expect(parseTimecode("1:75")).toBeNull(); // 75s isn't a valid ss segment
    expect(parseTimecode("-1:30")).toBeNull();
    expect(parseTimecode("1:")).toBeNull();
  });
});

describe("formatTimecode", () => {
  it("formats sub-hour as m:ss", () => {
    expect(formatTimecode(725)).toBe("12:05");
    expect(formatTimecode(5)).toBe("0:05");
  });

  it("formats past an hour as h:mm:ss", () => {
    expect(formatTimecode(3723)).toBe("1:02:03");
  });

  it("clamps negatives to 0:00", () => {
    expect(formatTimecode(-10)).toBe("0:00");
  });

  it("round-trips with parseTimecode", () => {
    expect(parseTimecode(formatTimecode(754))).toBe(754);
  });
});
