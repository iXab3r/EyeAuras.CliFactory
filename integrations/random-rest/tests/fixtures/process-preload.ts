// Test-only bootstrap: run the actual bin with synthetic AppData and a mocked network boundary.
import { AppArguments } from "@eyeauras/cli-factory";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const root = process.env.RANDOM_CLI_TEST_ROOT;
if (!root) throw new Error("Missing test AppData root.");
AppArguments.CurrentEnvironment = () => ({
  AppDomainDirectory: root, ApplicationExecutablePath: join(root, "test-bin.js"),
  EnvironmentAppData: root, EnvironmentLocalAppData: root, ProcessId: process.pid,
});
const server = setupServer(
  http.get("https://www.random.org/quota/", () => HttpResponse.text("1000")),
  http.get("https://www.random.org/integers/", ({ request }) => {
    const query = new URL(request.url).searchParams;
    if (Number(query.get("min")) >= Number(query.get("max"))) {
      return HttpResponse.text("Error: invalid range", { status: 503 });
    }
    return HttpResponse.text(Array(Number(query.get("num"))).fill(query.get("min")).join("\n"));
  }),
  http.get("https://www.random.org/sequences/", ({ request }) => {
    const query = new URL(request.url).searchParams;
    const min = Number(query.get("min"));
    const max = Number(query.get("max"));
    if (min >= max) return HttpResponse.text("Error: invalid range", { status: 503 });
    return HttpResponse.text(Array.from({ length: max - min + 1 }, (_, index) => max - index).join("\n"));
  }),
  http.get("https://failed.test/quota/", () => HttpResponse.text("synthetic-private-marker", { status: 503 })),
);
server.listen({ onUnhandledRequest: "error" });
process.once("exit", () => server.close());
