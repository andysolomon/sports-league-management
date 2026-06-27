import { describe, it, expect } from "vitest";
import { parseYoutubeVideoId, youtubeEmbedUrl } from "../youtube";

describe("parseYoutubeVideoId", () => {
  const ID = "dQw4w9WgXcQ"; // 11 chars

  it("parses the common URL shapes", () => {
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://youtube.com/watch?v=${ID}&t=10s`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("accepts a bare 11-char id", () => {
    expect(parseYoutubeVideoId(ID)).toBe(ID);
    expect(parseYoutubeVideoId(`  ${ID}  `)).toBe(ID);
  });

  it("rejects non-YouTube and malformed input", () => {
    expect(parseYoutubeVideoId("")).toBeNull();
    expect(parseYoutubeVideoId("not a url")).toBeNull();
    expect(parseYoutubeVideoId("https://vimeo.com/12345")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/")).toBeNull();
    expect(parseYoutubeVideoId("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("builds a no-cookie embed URL", () => {
    expect(youtubeEmbedUrl(ID)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}`,
    );
  });
});
