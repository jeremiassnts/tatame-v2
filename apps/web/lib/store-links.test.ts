import { describe, expect, it } from "vitest";
import { detectPlatform } from "./store-links";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPOD =
  "Mozilla/5.0 (iPod touch; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MACOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("detectPlatform", () => {
  it("reads iPhone, iPad and iPod as iOS", () => {
    for (const ua of [IPHONE, IPAD, IPOD]) {
      expect(detectPlatform(ua)).toBe("ios");
    }
  });

  it("reads an Android user-agent as Android", () => {
    expect(detectPlatform(ANDROID)).toBe("android");
  });

  it("highlights nothing when the platform is neither", () => {
    // Four separate ways of being neither: two real desktop browsers, a header
    // present but empty, and a header absent entirely. The last two are what a
    // crawler and a curl look like.
    expect(detectPlatform(MACOS)).toBeNull();
    expect(detectPlatform(WINDOWS)).toBeNull();
    expect(detectPlatform("")).toBeNull();
    expect(detectPlatform(undefined)).toBeNull();
  });
});
