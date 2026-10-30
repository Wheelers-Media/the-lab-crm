/** What the browser reports about the device; plain numbers so it can be tested. */
export interface DisplayReading {
  maxTouchPoints: number;
  innerWidth: number;
  screenWidth: number;
  screenHeight: number;
  /** visualViewport.scale: below 1 when the browser shrank a wide page to fit. */
  scale: number;
  userAgent: string;
}

const PHONE_WIDTH = 600;
const DESKTOP_WIDTH = 768;

/**
 * A phone that is showing the desktop page: Chrome's "Desktop site" asks for a
 * 980px layout and shrinks it to fit, so the window looks wide while the device
 * is not. It does not rely on any one signal, because the browser changes some
 * of them in that mode: a touch screen, plus a small screen, or a page that was
 * shrunk to a phone's width, or the desktop-Linux user agent Android sends.
 */
export const isPhoneInDesktopMode = (r: DisplayReading): boolean => {
  if (r.maxTouchPoints < 1 || r.innerWidth < DESKTOP_WIDTH) return false;
  const smallScreen = Math.min(r.screenWidth, r.screenHeight) < PHONE_WIDTH;
  const shrunkToPhone = r.innerWidth * r.scale < PHONE_WIDTH;
  const androidDesktopAgent =
    /Linux/.test(r.userAgent) &&
    !/Android|Mobile|iPhone|iPad/.test(r.userAgent);
  return smallScreen || shrunkToPhone || androidDesktopAgent;
};

/** The phone's real width in CSS pixels, as best the readings say. */
export const phoneWidth = (r: DisplayReading): number => {
  const shrunk = Math.round(r.innerWidth * r.scale);
  if (shrunk > 0 && shrunk < 700) return shrunk;
  const screen = Math.min(r.screenWidth, r.screenHeight);
  return screen > 0 && screen < 700 ? screen : 412;
};

export const readDisplay = (): DisplayReading => ({
  maxTouchPoints: navigator.maxTouchPoints ?? 0,
  innerWidth: window.innerWidth,
  screenWidth: window.screen.width,
  screenHeight: window.screen.height,
  scale: window.visualViewport?.scale ?? 1,
  userAgent: navigator.userAgent,
});
