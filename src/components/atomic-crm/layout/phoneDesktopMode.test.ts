import { describe, expect, it } from "vitest";

import {
  type DisplayReading,
  isPhoneInDesktopMode,
  phoneWidth,
} from "./phoneDesktopMode";

const reading = (over: Partial<DisplayReading> = {}): DisplayReading => ({
  maxTouchPoints: 5,
  innerWidth: 980,
  screenWidth: 412,
  screenHeight: 915,
  scale: 0.42,
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130",
  ...over,
});

describe("isPhoneInDesktopMode", () => {
  it("spots a phone showing the 980px desktop page", () => {
    expect(isPhoneInDesktopMode(reading())).toBe(true);
  });

  it("still spots it when the browser also reports a wide screen and no shrink", () => {
    // only the Linux desktop agent gives it away
    expect(
      isPhoneInDesktopMode(
        reading({ screenWidth: 980, screenHeight: 2100, scale: 1 }),
      ),
    ).toBe(true);
  });

  it("spots it by the page having been shrunk to a phone's width", () => {
    expect(
      isPhoneInDesktopMode(
        reading({
          screenWidth: 980,
          screenHeight: 2100,
          userAgent: "Mozilla/5.0 (Windows NT 10.0)",
        }),
      ),
    ).toBe(true);
  });

  it("leaves a real phone layout alone", () => {
    expect(isPhoneInDesktopMode(reading({ innerWidth: 412, scale: 1 }))).toBe(
      false,
    );
  });

  it("leaves laptops, touch laptops and tablets alone", () => {
    const laptop = reading({
      maxTouchPoints: 0,
      innerWidth: 1440,
      screenWidth: 1920,
      screenHeight: 1080,
      scale: 1,
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/130",
    });
    expect(isPhoneInDesktopMode(laptop)).toBe(false);
    expect(
      isPhoneInDesktopMode({
        ...laptop,
        maxTouchPoints: 10,
        userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      }),
    ).toBe(false);
    const ipad = reading({
      innerWidth: 1024,
      screenWidth: 820,
      screenHeight: 1180,
      scale: 1,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari",
    });
    expect(isPhoneInDesktopMode(ipad)).toBe(false);
  });
});

describe("phoneWidth", () => {
  it("prefers the width the page was shrunk to, then the screen, then a typical phone", () => {
    expect(phoneWidth(reading())).toBe(412);
    expect(
      phoneWidth(reading({ scale: 1, screenWidth: 390, screenHeight: 844 })),
    ).toBe(390);
    expect(
      phoneWidth(reading({ scale: 1, screenWidth: 980, screenHeight: 2100 })),
    ).toBe(412);
  });
});
