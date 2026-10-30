import { afterEach, describe, expect, it, vi } from "vitest";

import indexHtml from "../../index.html?raw";

// The watchdog is an inline script in index.html. It runs here, unchanged, in
// a throwaway frame that holds the same boot screen, with the wait cut short.
const WATCHDOG = /<script id="boot-watchdog"[^>]*>([\s\S]*?)<\/script>/.exec(
  indexHtml,
);
const WAIT_MS = 40;

const frames: HTMLIFrameElement[] = [];

const bootFrame = async ({
  appStarted = false,
  screen = "boot",
}: {
  appStarted?: boolean;
  /** What #root holds: the boot screen, a blank page, or the app itself */
  screen?: "boot" | "blank" | "app";
} = {}) => {
  if (!WATCHDOG) throw new Error("index.html has no boot watchdog script");
  const frame = document.createElement("iframe");
  frames.push(frame);
  frame.srcdoc = `<!doctype html>
    <html${appStarted ? ' data-boot="started"' : ""}><body>
      <div id="root">${
        {
          boot: '<div class="loader-container"><div class="loader-track"></div></div>',
          blank: '<div style="height: 100vh"></div>',
          app: "<main>The app</main>",
        }[screen]
      }</div>
      <script data-after="${WAIT_MS}">${WATCHDOG[1]}</script>
    </body></html>`;
  const loaded = new Promise((resolve) => {
    frame.onload = resolve;
  });
  document.body.appendChild(frame);
  await loaded;
  const win = frame.contentWindow as Window & typeof globalThis;
  return { win, doc: frame.contentDocument as Document };
};

const waitedOut = () => new Promise((resolve) => setTimeout(resolve, 200));

afterEach(() => {
  frames.splice(0).forEach((frame) => frame.remove());
});

describe("boot watchdog", () => {
  it("offers a reload and a reset, and names the error, when the app's code never started", async () => {
    // Arrange
    const { win, doc } = await bootFrame();
    win.dispatchEvent(
      new ErrorEvent("error", { message: "Unexpected token '<'" }),
    );

    // Act
    await vi.waitFor(() =>
      expect(doc.querySelector(".loader-help")).not.toBeNull(),
    );

    // Assert
    const text = doc.querySelector(".loader-help")?.textContent ?? "";
    expect(text).toContain("could not start");
    expect(text).toContain("Unexpected token '<'");
    const buttons = [...doc.querySelectorAll(".loader-help button")].map(
      (button) => button.textContent,
    );
    expect(buttons).toEqual(["Reload", "Reset the app"]);
  });

  it("says the app is slow, not broken, when its code started but did not finish opening", async () => {
    // Arrange
    const { doc } = await bootFrame({ appStarted: true });

    // Act
    await vi.waitFor(() =>
      expect(doc.querySelector(".loader-help")).not.toBeNull(),
    );

    // Assert
    expect(doc.querySelector(".loader-help")?.textContent).toContain(
      "taking longer than usual",
    );
  });

  it("covers a blank screen, and steps aside once the app draws something", async () => {
    // Arrange
    const { doc } = await bootFrame({ appStarted: true, screen: "blank" });
    await vi.waitFor(() =>
      expect(doc.querySelector(".loader-help")).not.toBeNull(),
    );
    expect(doc.querySelector("#root .loader-help")).toBeNull();

    // Act
    const root = doc.getElementById("root") as HTMLElement;
    root.textContent = "Sign in";

    // Assert
    await vi.waitFor(() =>
      expect(doc.querySelector(".loader-help")).toBeNull(),
    );
    expect(root.textContent).toBe("Sign in");
  });

  it("stays out of the way when the app has already replaced the boot screen", async () => {
    // Arrange
    const { doc } = await bootFrame({ appStarted: true, screen: "app" });

    // Act
    await waitedOut();

    // Assert
    expect(doc.querySelector(".loader-help")).toBeNull();
    expect(doc.querySelector("main")?.textContent).toBe("The app");
  });

  it("reset removes the service worker and its caches", async () => {
    // Arrange
    const { win, doc } = await bootFrame();
    const unregistered: string[] = [];
    const deleted: string[] = [];
    Object.defineProperty(win.navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: async () => [
          { unregister: async () => unregistered.push("sw") },
        ],
      },
    });
    Object.defineProperty(win, "caches", {
      configurable: true,
      value: {
        keys: async () => ["workbox-precache-v2", "runtime"],
        delete: async (key: string) => deleted.push(key),
      },
    });
    await vi.waitFor(() =>
      expect(doc.querySelector(".loader-help")).not.toBeNull(),
    );

    // Act
    (
      [...doc.querySelectorAll(".loader-help button")].find(
        (button) => button.textContent === "Reset the app",
      ) as HTMLButtonElement
    ).click();

    // Assert
    await vi.waitFor(() => {
      expect(unregistered).toEqual(["sw"]);
      expect(deleted).toEqual(["workbox-precache-v2", "runtime"]);
    });
  });
});
