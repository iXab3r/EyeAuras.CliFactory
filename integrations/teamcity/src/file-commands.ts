import { command, Permission, type CommandContext } from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import { clientLeaf, option, text, integerValue } from "./command-support.js";
import { referenceKey, type FileTree } from "./file-models.js";
import { fileTable, savedFileRecord, withView } from "./presentation.js";
export function createFileCommands(clientFor: (c: CommandContext) => Promise<TeamCityClient>) {
  const leaf = clientLeaf(clientFor),
    R = Permission.ReadOnly;
  const count = {
    ...option("--limit <count>", "Limit returned files"),
    defaultValue: 100,
    parse: integerValue,
  };
  const output = [
    option(
      "--output <path>",
      "Save to a relative or absolute path",
      false,
    ),
    {
      ...option("--max-bytes <bytes>", "Limit downloaded bytes"),
      parse: integerValue,
    },
  ];
  const destination = (o: Record<string, unknown>) => ({
    ...(typeof o.output === "string" ? { output: o.output } : {}),
    ...(o.maxBytes === undefined ? {} : { maxBytes: Number(o.maxBytes) }),
  });
  const tree = (name: string, kind: FileTree) =>
    command(name, "Browse and save files", [
      withView(fileTable, leaf(
        "list <id>",
        "List root files",
        R,
        (c, { args, options }) =>
          c.listFiles(kind, args.id, undefined, Number(options.limit)),
        [count],
      )),
      withView(fileTable, leaf(
        "children <id> <path>",
        "List directory children",
        R,
        (c, { args, options }) =>
          c.listFiles(kind, args.id, args.path, Number(options.limit)),
        [count],
      )),
      leaf("metadata <id> <path>", "Read file metadata", R, (c, { args }) =>
        c.getFileMetadata(kind, args.id, args.path),
      ),
      ...(["download", "archive"] as const).map((action) =>
        command(
          `${action} <id> <path>`,
          action === "archive"
            ? "Save a directory as ZIP"
            : "Save a file",
          async ({ args, options }, context) =>
            (await clientFor(context)).downloadFile(
              kind,
              text(args, "id"),
              text(args, "path"),
              action === "archive",
              Number(options.limit ?? 100),
              context.cwd,
              destination(options),
            ),
          {
            permission: R,
            options: [...output, ...(action === "archive" ? [count] : [])],
            view: savedFileRecord,
          },
        ),
      ),
    ]);
  const avatar = ["download", "download-hash"].map((action) =>
    command(
      `${action} <id>${action === "download-hash" ? " <hash>" : ""}`,
      "Save a PNG avatar",
      async ({ args, options }, context) =>
        (await clientFor(context)).downloadAvatar(
          text(args, "id"),
          Number(options.size),
          action === "download-hash" ? text(args, "hash") : undefined,
          context.cwd,
          destination(options),
        ),
      {
        permission: R,
        options: [...output, { ...option("--size <pixels>", "Set image size in pixels"), defaultValue: 64, parse: integerValue }],
        view: savedFileRecord,
      },
    ),
  );
  const builds = [
    tree("artifacts", "builds"),
    leaf(
      "artifacts-path <id>",
      "Read the server artifact directory path",
      R,
      (c, { args }) => c.getArtifactsPath(args.id),
    ),
    command(
      "source <id> <path>",
      "Save one source file from selected build",
      async ({ args, options }, context) =>
        (await clientFor(context)).downloadSource(
          args.id,
          args.path,
          context.cwd,
          destination(options),
        ),
      { permission: R, options: output, view: savedFileRecord },
    ),
    ...(["icon", "aggregate-icon"] as const).map((action) =>
      command(
        `${action} <id>`,
        "Save a build status SVG",
        async ({ args, options }, context) =>
          (await clientFor(context)).downloadStatusIcon(
            text(args, "id"),
            action === "aggregate-icon",
            Number(options.limit ?? 100),
            context.cwd,
            destination(options),
          ),
        {
          permission: R,
          options: [...output, ...(action === "aggregate-icon" ? [count] : [])],
          view: savedFileRecord,
        },
      ),
    ),
    command(
      "resolve-parameter <id> <name>",
      "Save a resolved parameter as a secret alias",
      async ({ args, options }, context) =>
        (await clientFor(context)).resolveBuildParameter(
          args.id,
          args.name,
          text(options, "storeAs"),
          context.secrets,
        ),
      {
        permission: "Credentials",
        options: [option("--store-as <alias>", "Choose a new input-secret alias", true)],
      },
    ),
  ];
  const settings = (kind: "projects" | "jobs" | "roots") =>
    leaf(
      "settings-path <id>",
      "Read the server configuration path",
      R,
      (c, { args }) => c.getSettingsPath(kind, args.id),
    );
  const projects = [
    settings("projects"),
    command("secure", "Manage project secure references", [
      command(
        "create-reference <id>",
        "Save a reference from an input-secret alias",
        async ({ args, options }, context) =>
          (await clientFor(context)).createSecureReference(
            args.id,
            text(options, "valueSecret"),
            text(options, "storeAs"),
            context.secrets,
          ),
        {
          permission: "Credentials",
          options: [
            option("--value-secret <alias>", "Select an input-secret source", true),
            option("--store-as <alias>", "Choose a new secure-reference alias", true),
          ],
        },
      ),
      command(
        "resolve <id>",
        "Resolve a secure reference into secret storage",
        async ({ args, options }, context) =>
          (await clientFor(context)).resolveSecureReference(
            args.id,
            text(options, "reference"),
            text(options, "storeAs"),
            context.secrets,
          ),
        {
          permission: "Credentials",
          options: [
            option("--reference <alias>", "Select a secure-reference alias", true),
            option("--store-as <alias>", "Choose a new input-secret destination", true),
          ],
        },
      ),
      command(
        "forget-reference <alias>",
        "Forget a local secure reference",
        async ({ args }, context) => {
          const alias = args.alias;
          try {
            await context.secrets.delete(referenceKey(alias));
          } catch {
            throw new Error("Could not remove secure-reference entry.");
          }
          return { alias, forgotten: true };
        },
        { permission: "Credentials" },
      ),
    ]),
  ];
  return {
    avatar,
    builds,
    projects,
    jobs: [settings("jobs"), tree("files", "jobs")],
    server: [tree("files", "server")],
    roots: [settings("roots")],
    instances: [tree("files", "instances")],
  };
}
