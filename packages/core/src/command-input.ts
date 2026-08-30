import type { CommandContext, CommandHandler, CommandInput } from "./types.js";

type LowerLetter =
  | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
  | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";
type NameCharacter = LowerLetter | Uppercase<LowerLetter> | "_" | "-"
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type LiteralName<Text extends string> = Text extends `${infer First}${infer Rest}`
  ? First extends NameCharacter
    ? Rest extends ""
      ? true
      : LiteralName<Rest>
    : false
  : false;
type IsUnion<Value, Whole = Value> = Value extends Whole
  ? [Whole] extends [Value]
    ? false
    : true
  : never;

type AddArgument<Token extends string, Args> = Token extends `<${infer Name}>`
  ? LiteralName<Name> extends true
    ? Name extends keyof Args
      ? never
      : Args & Record<Name, string>
    : never
  : never;
type ParseArguments<Text extends string, Args = {}> = Text extends `${infer Token} ${infer Rest}`
  ? [AddArgument<Token, Args>] extends [never]
    ? never
    : ParseArguments<Rest, AddArgument<Token, Args>>
  : AddArgument<Text, Args>;
type ParseCommand<Syntax extends string> = Syntax extends `${infer Name} ${infer Rest}`
  ? LiteralName<Name> extends true
    ? ParseArguments<Rest>
    : never
  : LiteralName<Syntax> extends true
    ? {}
    : never;
type CommandArguments<Syntax extends string> = string extends Syntax
  ? Record<string, unknown>
  : IsUnion<Syntax> extends true
    ? Record<string, unknown>
    : [ParseCommand<Syntax>] extends [never]
      ? Record<string, unknown>
      : ParseCommand<Syntax>;

export type InferredCommandHandler<Syntax extends string> = (
  input: Omit<CommandInput, "args"> & { args: CommandArguments<Syntax> },
  context: CommandContext,
) => ReturnType<CommandHandler>;
