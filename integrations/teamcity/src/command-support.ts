import {
  command,
  jsonParser,
  type CommandContext,
  type CommandDefinition,
  type InferredCommandHandler,
  type OptionDefinition,
} from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import type { PlainProperty } from "./authoring-models.js";
import { requiredText } from "./locator.js";

export function text(values: Record<string, unknown>, key: string): string {
  if (typeof values[key] !== "string") throw new Error(`Missing ${key}.`);
  return values[key];
}
export function optionalText(values: Record<string, unknown>, key: string): Record<string, string> {
  return typeof values[key] === "string" ? { [key]: values[key] } : {};
}
export function option(flags: string, description: string, required = false): OptionDefinition {
  return { flags, description, required };
}
export function repeatOption(
  flags: string,
  description: string,
  required = false,
): OptionDefinition {
  return {
    flags,
    description,
    required,
    parse: (value, previous) => [...(Array.isArray(previous) ? (previous as string[]) : []), value],
  };
}
const typedJson = jsonParser("Expected valid typed JSON; input is not echoed.");
export function jsonOption(flags: string, description: string, repeat = false): OptionDefinition {
  return {
    flags,
    description,
    required: true,
    parse(value, previous) {
      const item = typedJson(value);
      return repeat ? [...(Array.isArray(previous) ? previous : []), item] : item;
    },
  };
}
function collectProperty(value: string, previous: unknown): PlainProperty[] {
  const separator = value.indexOf("=");
  if (separator < 1) throw new Error("--property requires a non-empty key=value pair.");
  const name = requiredText(value.slice(0, separator), "Property key");
  const properties = Array.isArray(previous) ? (previous as PlainProperty[]) : [];
  if (properties.some((p) => p.name === name))
    throw new Error("Duplicate property keys are not allowed.");
  return [...properties, { name, value: value.slice(separator + 1) }];
}
export const propertyOption: OptionDefinition = {
  flags: "--property <key=value>",
  description: "Repeat for each non-secret property; never credentials",
  parse: collectProperty,
};

export type ClientLeaf = <const Syntax extends string>(
  name: Syntax,
  description: string,
  permission: string,
  run: (client: TeamCityClient, input: Parameters<InferredCommandHandler<Syntax>>[0]) => unknown,
  options?: readonly OptionDefinition[],
) => CommandDefinition;

// Only binds the profile-scoped client; Core still owns the one recursive command model.
export function clientLeaf(
  clientFor: (context: CommandContext) => Promise<TeamCityClient>,
): ClientLeaf {
  return (name, description, permission, run, options = []) =>
    command(name, description, async (input, context) => run(await clientFor(context), input), {
      permission,
      options,
    });
}
