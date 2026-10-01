import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { defaultHomepageResponse } from "@/lib/default-homepage";

async function themeBrowser(initial: Record<string, string>, dark = false) {
  const values = new Map(Object.entries(initial));
  const events: Record<string, () => void> = {};
  const media = { matches: dark, addEventListener: (name: string, fn: () => void) => { events[`media:${name}`] = fn; } };
  const button = { setAttribute() {}, querySelectorAll: () => [], addEventListener: (name: string, fn: () => void) => { events[name] = fn; } };
  const root = { dataset: {} as Record<string, string>, style: {} };
  const document = { documentElement: root, body: {}, cookie: "", querySelector: (selector: string) => selector === "[data-theme-cycle]" ? button : null,
    querySelectorAll: () => [{ content: "" }], addEventListener: (name: string, fn: () => void) => { events[name] = fn; } };
  const context = { document, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
    window: { matchMedia: () => media }, MutationObserver: class { observe() {} }, getComputedStyle: () => ({ getPropertyValue: () => "#fff" }) };
  const html = await defaultHomepageResponse().text();
  runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)![1], context);
  events.DOMContentLoaded();
  return { context, root, values, events, media };
}

describe("shared homepage and login theme", () => {
  it.each(["light", "dark", "auto"])("carries %s from homepage to the login theme script", async (choice) => {
    const browser = await themeBrowser({ "surls-theme": choice }, true);
    expect(browser.context.document.cookie).toContain(`surls-theme=${choice};`);
    runInNewContext(readFileSync("public/surls-theme.js", "utf8"), browser.context);
    expect(browser.root.dataset.theme).toBe(choice === "light" ? "light" : "dark");
  });
  it("migrates the old homepage preference and persists system mode explicitly", async () => {
    const browser = await themeBrowser({ "surls-home-theme": "light" });
    expect(browser.values.get("surls-theme")).toBe("light");
    browser.events.click();
    expect(browser.values.get("surls-theme")).toBe("auto");
    browser.media.matches = true; browser.events["media:change"]();
    expect(browser.root.dataset.theme).toBe("dark");
  });
  it("prefers the shared choice over an obsolete homepage preference", async () => {
    const browser = await themeBrowser({ "surls-home-theme": "light", "surls-theme": "dark" });
    expect(browser.root.dataset.theme).toBe("dark");
  });
});
