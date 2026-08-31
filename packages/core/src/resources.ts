import type { CliResource } from "./types.js";

/** Runtime composition helper; resources are concrete instances, never a dependency container. */
export async function visitResources(
  resources: readonly CliResource[],
  visit: (resource: CliResource) => void | Promise<void>,
): Promise<void> {
  const errors: unknown[] = [];
  for (const resource of [...new Set(resources)].reverse()) {
    try {
      await visit(resource);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, "Application resource cleanup failed.");
}
