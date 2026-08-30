import { command, Permission, type CommandContext } from "@eyeauras/cli-factory";
import type { TeamCityClient } from "./client.js";
import { clientLeaf, option, text } from "./command-support.js";
import { referenceKey, type FileTree } from "./file-models.js";
export function createFileCommands(clientFor: (c: CommandContext) => Promise<TeamCityClient>) {
  const leaf = clientLeaf(clientFor),
    R = Permission.ReadOnly;
  const count = {
    ...option("--limit <count>", "Maximum100 files; no recursive traversal"),
    defaultValue: 100,
  };
  const output = [
    option(
      "--output <name>",
      "New basename inside active profile downloads; never overwrite",
      true,
    ),
    {
      ...option("--max-bytes <bytes>", "Actual stream limit, at most64MiB"),
      defaultValue: 16 * 1024 * 1024,
    },
  ];
  const destination = (o: Record<string, unknown>) => ({
    output: text(o, "output"),
    maxBytes: Number(o.maxBytes),
  });
  const tree = (name: string, kind: FileTree) =>
    command(name, "Literal relative paths; files may contain private data", [
      leaf(
        "list <id>",
        "List root files, not recursively",
        R,
        (c, { args, options }) =>
          c.listFiles(kind, text(args, "id"), undefined, Number(options.limit)),
        [count],
      ),
      leaf(
        "children <id> <path>",
        "List immediate children at a relative path",
        R,
        (c, { args, options }) =>
          c.listFiles(kind, text(args, "id"), text(args, "path"), Number(options.limit)),
        [count],
      ),
      leaf("metadata <id> <path>", "Read one file metadata object", R, (c, { args }) =>
        c.getFileMetadata(kind, text(args, "id"), text(args, "path")),
      ),
      ...(["download", "archive"] as const).map((action) =>
        command(
          `${action} <id> <path>`,
          action === "archive"
            ? "Save bounded nonrecursive ZIP; never extract"
            : "Save actual bytes under active profile",
          async ({ args, options }, context) =>
            (await clientFor(context)).downloadFile(
              kind,
              text(args, "id"),
              text(args, "path"),
              action === "archive",
              Number(options.limit ?? 100),
              context.appArguments,
              destination(options),
            ),
          { permission: R, options: [...output, ...(action === "archive" ? [count] : [])] },
        ),
      ),
    ]);
  const avatar = ["download", "download-hash"].map((action) =>
    command(
      `${action} <id>${action === "download-hash" ? " <hash>" : ""}`,
      "Save current PNG avatar; stale hash returns404",
      async ({ args, options }, context) =>
        (await clientFor(context)).downloadAvatar(
          text(args, "id"),
          Number(options.size),
          action === "download-hash" ? text(args, "hash") : undefined,
          context.appArguments,
          destination(options),
        ),
      {
        permission: R,
        options: [...output, { ...option("--size <pixels>", "PNG size2–300"), defaultValue: 64 }],
      },
    ),
  );
  const builds = [
    tree("artifacts", "builds"),
    leaf(
      "artifacts-path <id>",
      "Read absolute SERVER directory path; do not open locally",
      R,
      (c, { args }) => c.getArtifactsPath(text(args, "id")),
    ),
    command(
      "source <id> <path>",
      "Save one source file from selected build",
      async ({ args, options }, context) =>
        (await clientFor(context)).downloadSource(
          text(args, "id"),
          text(args, "path"),
          context.appArguments,
          destination(options),
        ),
      { permission: R, options: output },
    ),
    ...(["icon", "aggregate-icon"] as const).map((action) =>
      command(
        `${action} <id>`,
        "Save SVG without rendering; HTTP success does not imply build success",
        async ({ args, options }, context) =>
          (await clientFor(context)).downloadStatusIcon(
            text(args, "id"),
            action === "aggregate-icon",
            Number(options.limit ?? 100),
            context.appArguments,
            destination(options),
          ),
        { permission: R, options: [...output, ...(action === "aggregate-icon" ? [count] : [])] },
      ),
    ),
    command(
      "resolve-parameter <id> <name>",
      "Resolve one parameter to a new keyring alias; never print value",
      async ({ args, options }, context) =>
        (await clientFor(context)).resolveBuildParameter(
          text(args, "id"),
          text(args, "name"),
          text(options, "storeAs"),
          context.secrets,
        ),
      {
        permission: "Credentials",
        options: [option("--store-as <alias>", "Unused input-secret alias", true)],
      },
    ),
  ];
  const settings = (kind: "projects" | "jobs" | "roots") =>
    leaf(
      "settings-path <id>",
      "Read absolute SERVER configuration path, not file contents",
      R,
      (c, { args }) => c.getSettingsPath(kind, text(args, "id")),
    );
  const projects = [
    settings("projects"),
    command("secure", "Project secure references; these are NOT REST access tokens", [
      command(
        "create-reference <id>",
        "Create/reuse reference from an input-secret alias and store it in keyring",
        async ({ args, options }, context) =>
          (await clientFor(context)).createSecureReference(
            text(args, "id"),
            text(options, "valueSecret"),
            text(options, "storeAs"),
            context.secrets,
          ),
        {
          permission: "Credentials",
          options: [
            option("--value-secret <alias>", "Input-secret source", true),
            option("--store-as <alias>", "Unused secure-reference alias", true),
          ],
        },
      ),
      command(
        "resolve <id>",
        "Resolve secret reference into a new input-secret alias; never print",
        async ({ args, options }, context) =>
          (await clientFor(context)).resolveSecureReference(
            text(args, "id"),
            text(options, "reference"),
            text(options, "storeAs"),
            context.secrets,
          ),
        {
          permission: "Credentials",
          options: [
            option("--reference <alias>", "Secure-reference source", true),
            option("--store-as <alias>", "Unused input-secret destination", true),
          ],
        },
      ),
      command(
        "forget-reference <alias>",
        "Delete only a local secure-reference entry, not remote value",
        async ({ args }, context) => {
          const alias = text(args, "alias");
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
