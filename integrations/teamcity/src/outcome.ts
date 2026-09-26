import type { TeamCityBuild } from "./models.js";

/** How a finished build ended. A canceled build is never reported as failed or successful. */
export type BuildOutcome = "succeeded" | "failed" | "canceled" | "unknown";

/** The outcome of a finished build; undefined while it is queued or running. */
export function buildOutcome(build: TeamCityBuild): BuildOutcome | undefined {
  if (build.state !== "finished") return undefined;
  if (build.canceledInfo !== undefined) return "canceled";
  if (build.failedToStart === true || build.status === "FAILURE") return "failed";
  return build.status === "SUCCESS" ? "succeeded" : "unknown";
}
