import { command } from "./command.js";
import type { InferredCommandHandler } from "./command-input.js";
import { Permission } from "./permissions.js";
import type {
  CommandContext,
  CommandDefinition,
  OptionDefinition,
} from "./types.js";

type CommandInputFor<Syntax extends string> = Parameters<InferredCommandHandler<Syntax>>[0];

export type TargetCommandHandler<Target, Syntax extends string> = (
  target: Target,
  input: CommandInputFor<Syntax>,
  context: CommandContext,
) => unknown;

export type TargetCommand<Target> = <const Syntax extends string>(
  syntax: Syntax,
  description: string,
  permission: string,
  run: TargetCommandHandler<Target, Syntax>,
  options?: readonly OptionDefinition[],
) => CommandDefinition;

export type GatedTargetCommand<Target> = <const Syntax extends string>(
  syntax: Syntax,
  description: string,
  run: TargetCommandHandler<Target, Syntax>,
  options?: readonly OptionDefinition[],
) => CommandDefinition;

export interface TargetCommands<Target> {
  command: TargetCommand<Target>;
  read: GatedTargetCommand<Target>;
  update: GatedTargetCommand<Target>;
  gated(permission: string): GatedTargetCommand<Target>;
}

/**
 * Bind service leaves to one invocation-scoped target such as an authenticated HTTP client.
 * Resolution still happens after Core selects the profile and admits the permission gate.
 */
export function targetCommands<Target>(
  resolve: (context: CommandContext) => Target | Promise<Target>,
): TargetCommands<Target> {
  const targetCommand: TargetCommand<Target> = (
    syntax,
    description,
    permission,
    run,
    options = [],
  ) =>
    command(
      syntax,
      description,
      async (input, context) => run(await resolve(context), input, context),
      { permission, options },
    );
  const gated = (permission: string): GatedTargetCommand<Target> =>
    (syntax, description, run, options) =>
      targetCommand(syntax, description, permission, run, options);

  return {
    command: targetCommand,
    read: gated(Permission.ReadOnly),
    update: gated(Permission.Update),
    gated,
  };
}
