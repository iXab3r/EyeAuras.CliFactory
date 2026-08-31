// Independently authored native wire contracts; no production path/schema imports.
export interface FileCase {
  method: "GET" | "POST";
  path: string;
  argv: string[];
  query?: Record<string, string>;
  response: unknown;
  expected?: unknown;
  bytes?: Uint8Array;
  media?: string;
  body?: string;
  permission?: string;
  storedSecrets?: Record<string, string>;
  storedKey?: string;
  storedValue?: string;
}
export const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
export const zipBytes = Uint8Array.from([80, 75, 5, 6, ...Array(18).fill(0)]);
export const sourceBytes = Uint8Array.from([0, 255, 128, 13, 10, 65]);
export const svgBytes = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
);
const file = { name: "example.bin", size: 6, modificationTime: "20260830T120000+0000" };
const ff = "name,size,modificationTime",
  lf = `count,file(${ff})`;
const locator = "count:100,recursive:false,hidden:false,browseArchives:false";
function tree(prefix: string[], path: string, query: Record<string, string> = {}): FileCase[] {
  return [
    {
      method: "GET",
      path,
      argv: [
        ...prefix,
        "list",
        prefix[0] === "server"
          ? "logs"
          : prefix[0] === "builds"
            ? "7"
            : prefix[0] === "vcs"
              ? "8"
              : "Build",
      ],
      query: { ...query, locator, fields: lf },
      response: { count: 1, file: [file] },
      expected: { count: 1, items: [file] },
    },
    {
      method: "GET",
      path: path + "/archived/docs",
      argv: [
        ...prefix,
        "archive",
        prefix[0] === "server"
          ? "logs"
          : prefix[0] === "builds"
            ? "7"
            : prefix[0] === "vcs"
              ? "8"
              : "Build",
        "docs",
        "--output",
        "example.zip",
      ],
      query: { ...query, locator },
      response: null,
      bytes: zipBytes,
      media: "application/zip",
    },
    {
      method: "GET",
      path: path + "/files/docs/example.bin",
      argv: [
        ...prefix,
        "download",
        prefix[0] === "server"
          ? "logs"
          : prefix[0] === "builds"
            ? "7"
            : prefix[0] === "vcs"
              ? "8"
              : "Build",
        "docs/example.bin",
        "--output",
        "example.bin",
      ],
      query,
      response: null,
      bytes: sourceBytes,
      media: "application/octet-stream",
    },
    {
      method: "GET",
      path: path + "/metadata/docs/example.bin",
      argv: [
        ...prefix,
        "metadata",
        prefix[0] === "server"
          ? "logs"
          : prefix[0] === "builds"
            ? "7"
            : prefix[0] === "vcs"
              ? "8"
              : "Build",
        "docs/example.bin",
      ],
      query: { ...query, fields: ff },
      response: file,
      expected: file,
    },
    {
      method: "GET",
      path: path + "/docs",
      argv: [
        ...prefix,
        "children",
        prefix[0] === "server"
          ? "logs"
          : prefix[0] === "builds"
            ? "7"
            : prefix[0] === "vcs"
              ? "8"
              : "Build",
        "docs",
      ],
      query: { ...query, locator, fields: lf },
      response: { count: 1, file: [file] },
      expected: { count: 1, items: [file] },
    },
  ];
}
export const fileCases: readonly FileCase[] = [
  {
    method: "GET",
    path: "/avatars/id:3/64/avatar.png",
    argv: ["users", "avatar", "download", "3", "--size", "64", "--output", "avatar.png"],
    response: null,
    bytes: pngBytes,
    media: "image/png",
  },
  {
    method: "GET",
    path: "/avatars/id:3/64/avatar.abc123.png",
    argv: [
      "users",
      "avatar",
      "download-hash",
      "3",
      "abc123",
      "--size",
      "64",
      "--output",
      "avatar.png",
    ],
    response: null,
    bytes: pngBytes,
    media: "image/png",
  },
  {
    method: "GET",
    path: "/buildTypes/id:Build/settingsFile",
    argv: ["jobs", "settings-path", "Build"],
    media: "text/plain",
    response: "/srv/teamcity-example/config/Build.xml",
    expected: { serverPath: "/srv/teamcity-example/config/Build.xml" },
  },
  ...tree(["jobs", "files"], "/buildTypes/id:Build/vcs/files/latest", {
    resolveParameters: "false",
  }),
  {
    method: "GET",
    path: "/builds/aggregated/buildType:(id:Build),count:100/statusIcon.svg",
    argv: ["builds", "aggregate-icon", "Build", "--output", "icon.svg"],
    response: null,
    bytes: svgBytes,
    media: "image/svg+xml",
  },
  ...tree(["builds", "artifacts"], "/builds/id:7/artifacts", {
    resolveParameters: "false",
    logBuildUsage: "false",
  }),
  {
    method: "GET",
    path: "/builds/id:7/artifactsDirectory",
    argv: ["builds", "artifacts-path", "7"],
    media: "text/plain",
    response: "/srv/teamcity-example/artifacts/7",
    expected: { serverPath: "/srv/teamcity-example/artifacts/7" },
  },
  {
    method: "GET",
    path: "/builds/id:7/resolved/%25env.MODE%25",
    argv: ["builds", "resolve-parameter", "7", "env.MODE", "--store-as", "resolved"],
    media: "text/plain",
    response: "synthetic-resolved-value",
    expected: { alias: "resolved", stored: true },
    permission: "Credentials",
    storedKey: "input-secret:resolved",
    storedValue: "synthetic-resolved-value",
  },
  {
    method: "GET",
    path: "/builds/id:7/sources/files/src/example.ts",
    argv: ["builds", "source", "7", "src/example.ts", "--output", "example.ts"],
    response: null,
    bytes: sourceBytes,
    media: "application/octet-stream",
  },
  {
    method: "GET",
    path: "/builds/id:7/statusIcon.svg",
    argv: ["builds", "icon", "7", "--output", "icon.svg"],
    response: null,
    bytes: svgBytes,
    media: "image/svg+xml",
  },
  {
    method: "POST",
    path: "/projects/id:Example/secure/tokens",
    argv: [
      "projects",
      "secure",
      "create-reference",
      "Example",
      "--value-secret",
      "input",
      "--store-as",
      "reference",
    ],
    media: "text/plain",
    body: " synthetic-value ",
    storedSecrets: { "input-secret:input": " synthetic-value " },
    response: "synthetic-reference",
    expected: { projectId: "Example", referenceAlias: "reference", stored: true },
    permission: "Credentials",
    storedKey: "secure-reference:reference",
    storedValue: "synthetic-reference",
  },
  {
    method: "GET",
    path: "/projects/id:Example/secure/values/synthetic-reference",
    argv: [
      "projects",
      "secure",
      "resolve",
      "Example",
      "--reference",
      "reference",
      "--store-as",
      "value",
    ],
    media: "text/plain",
    storedSecrets: { "secure-reference:reference": "synthetic-reference" },
    response: " synthetic-value ",
    expected: { alias: "value", stored: true },
    permission: "Credentials",
    storedKey: "input-secret:value",
    storedValue: " synthetic-value ",
  },
  {
    method: "GET",
    path: "/projects/id:Example/settingsFile",
    argv: ["projects", "settings-path", "Example"],
    media: "text/plain",
    response: "/srv/teamcity-example/config/Example.xml",
    expected: { serverPath: "/srv/teamcity-example/config/Example.xml" },
  },
  ...tree(["server", "files"], "/server/files/logs"),
  ...tree(["vcs", "instances", "files"], "/vcs-root-instances/id:8/files/latest"),
  {
    method: "GET",
    path: "/vcs-roots/id:Git/settingsFile",
    argv: ["vcs", "roots", "settings-path", "Git"],
    media: "text/plain",
    response: "/srv/teamcity-example/vcs/Git.xml",
    expected: { serverPath: "/srv/teamcity-example/vcs/Git.xml" },
  },
];
