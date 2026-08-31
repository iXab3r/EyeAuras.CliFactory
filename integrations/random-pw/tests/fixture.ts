import type { BrowserContext } from "playwright";

export interface SiteState {
  quota: number;
  requests: string[];
  submits: number;
  mode?: "bad" | "duplicate" | "http-error";
}
export const site = (state: SiteState) => async (context: BrowserContext) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin !== "https://www.random.org" &&
      url.origin !== "https://fixture.test"
    ) {
      await route.abort();
      return;
    }
    state.requests.push(url.pathname);
    if (url.pathname === "/quota/") {
      await route.fulfill({
        contentType: "text/html",
        body: `<p>Current allowance: ${state.quota} bits</p>`,
      });
      return;
    }
    if (!["/integers/", "/sequences/"].includes(url.pathname)) {
      await route.abort();
      return;
    }
    const sequence = url.pathname === "/sequences/";
    if (url.searchParams.has("min")) {
      state.submits++;
      const min = Number(url.searchParams.get("min")),
        max = Number(url.searchParams.get("max"));
      const count = sequence
        ? max - min + 1
        : Number(url.searchParams.get("num"));
      const values = Array.from({ length: count }, (_, i) =>
        sequence ? max - i : min,
      );
      await route.fulfill({
        status: state.mode === "http-error" ? 503 : 200,
        contentType: "text/html",
        body: `<pre class="data">${state.mode === "bad" ? "synthetic-private-marker" : state.mode === "duplicate" ? Array(count).fill(min).join("\n") : values.join("\n")}</pre>`,
      });
      return;
    }
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
      <button onclick="this.remove()">Allow Selected</button>
      <form action="${url.pathname}">
        <input name="min"><input name="max"><input name="col">
        ${sequence ? "" : '<input name="num">'}
        <input type="hidden" name="format" value="html"><input type="submit" value="Get Numbers">
      </form>`,
    });
  });
};
