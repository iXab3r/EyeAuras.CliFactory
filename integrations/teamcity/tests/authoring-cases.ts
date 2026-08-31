// Synthetic contracts from the official TeamCity REST reference, not captured service payloads.
export interface AuthoringCase {
  argv: string[];
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  text?: boolean;
  jsonResponse?: boolean;
  permission?: string;
  responseStatus?: number;
  storedSecrets?: Record<string, string>;
  response: unknown;
  expected: unknown;
  preflight?: string;
  preflightResponse?: unknown;
  preflightFields?: string;
}

const project = { id: "Example", name: "Example", archived: false };
const job = {
  id: "Example_Build",
  name: "Build",
  projectId: "Example",
  projectName: "Example",
  paused: false,
};
const property = { name: "env.MODE", value: "debug", inherited: false, type: { rawValue: "text" } };
const safeProperty = {
  name: "env.MODE",
  value: "debug",
  inherited: false,
  type: "text",
  redacted: false,
};
const propertyFields = "name,value,inherited,type(rawValue)";
const stepBody = {
  name: "Echo",
  type: "simpleRunner",
  properties: {
    property: [
      { name: "script.content", value: "echo a=b" },
      { name: "use.custom.script", value: "true" },
    ],
  },
};
const step = { id: "RUNNER_1", ...stepBody, disabled: false };
const safeStep = {
  id: "RUNNER_1",
  name: "Echo",
  type: "simpleRunner",
  disabled: false,
  properties: [
    { name: "script.content", redacted: true, type: "plain" },
    { name: "use.custom.script", value: "true", redacted: false, type: "plain" },
  ],
};
const stepOptions = [
  "--name",
  "Echo",
  "--type",
  "simpleRunner",
  "--property",
  "script.content=echo a=b",
  "--property",
  "use.custom.script=true",
];
const stepFields = `id,name,type,disabled,inherited,properties(property(${propertyFields}))`;
const root = {
  id: "Example_Git",
  name: "Git",
  vcsName: "jetbrains.git",
  project: { id: "Example", name: "Example" },
};
const rootFields = "id,name,vcsName,project(id,name)";
const entry = { "vcs-root": root, "checkout-rules": "+:src=>." };
const safeEntry = { root, rules: "+:src=>." };
const entryFields = `vcs-root(${rootFields}),checkout-rules`;
const jobPath = "/buildTypes/id:Example_Build";
const entryPath = `${jobPath}/vcs-root-entries/id:Example_Git`;

export const authoringCases: AuthoringCase[] = [
  {
    argv: ["projects", "create", "Example", "--name", "Example"],
    method: "POST",
    path: "/projects",
    body: { id: "Example", name: "Example", parentProject: { id: "_Root" } },
    query: { fields: "id,name,parentProjectId,archived,description,webUrl" },
    response: project,
    expected: project,
  },
  {
    argv: ["projects", "set", "Example", "archived", "true"],
    method: "PUT",
    path: "/projects/id:Example/archived",
    text: true,
    body: "true",
    response: "true",
    expected: { id: "Example", field: "archived", value: "true" },
  },
  {
    argv: ["projects", "move", "Example", "--parent", "Parent"],
    method: "PUT",
    path: "/projects/id:Example/parentProject",
    body: { id: "Parent" },
    response: null,
    expected: { id: "Example", parentProjectId: "Parent", moved: true },
  },
  {
    argv: ["projects", "delete", "Example"],
    method: "DELETE",
    path: "/projects/id:Example",
    response: null,
    expected: { id: "Example", deleted: true },
  },
  {
    argv: ["jobs", "create", "Example_Build", "--name", "Build", "--project", "Example"],
    method: "POST",
    path: "/buildTypes",
    body: { id: "Example_Build", name: "Build", project: { id: "Example" } },
    query: { fields: "id,name,projectId,projectName,paused,description,webUrl" },
    response: job,
    expected: job,
  },
  {
    argv: ["jobs", "set", "Example_Build", "paused", "false"],
    method: "PUT",
    path: `${jobPath}/paused`,
    text: true,
    body: "false",
    response: "false",
    expected: { id: "Example_Build", field: "paused", value: "false" },
  },
  {
    argv: ["jobs", "move", "Example_Build", "--project", "Parent"],
    method: "POST",
    path: `${jobPath}/move`,
    query: { targetProjectId: "Parent" },
    response: null,
    expected: { id: "Example_Build", projectId: "Parent", moved: true },
  },
  {
    argv: ["jobs", "delete", "Example_Build"],
    method: "DELETE",
    path: jobPath,
    response: null,
    expected: { id: "Example_Build", deleted: true },
  },
  ...(["projects", "jobs"] as const).flatMap((owner): AuthoringCase[] => {
    const id = owner === "projects" ? "Example" : "Example_Build";
    const path = `${owner === "projects" ? "/projects/id:Example" : jobPath}/parameters`;
    return [
      {
        argv: [owner, "parameters", "list", id],
        method: "GET",
        path,
        query: { fields: `property(${propertyFields})` },
        response: { property: [property] },
        expected: [safeProperty],
      },
      {
        argv: [owner, "parameters", "show", id, "env.MODE"],
        method: "GET",
        path: `${path}/env.MODE`,
        query: { fields: propertyFields },
        response: property,
        expected: safeProperty,
      },
      ...(["create", "set"] as const).map(
        (action): AuthoringCase => ({
          argv: [owner, "parameters", action, id, "env.MODE", "--value", "debug"],
          method: action === "create" ? "POST" : "PUT",
          path: action === "create" ? path : `${path}/env.MODE`,
          preflight: `${path}/env.MODE`,
          body: { name: "env.MODE", value: "debug" },
          query: { fields: propertyFields },
          response: property,
          expected: safeProperty,
        }),
      ),
      {
        argv: [owner, "parameters", "delete", id, "env.MODE"],
        method: "DELETE",
        path: `${path}/env.MODE`,
        response: null,
        expected: { owner, id, name: "env.MODE", deleted: true },
      },
    ];
  }),
  {
    argv: ["jobs", "steps", "list", "Example_Build"],
    method: "GET",
    path: `${jobPath}/steps`,
    query: { fields: `step(${stepFields})` },
    response: { step: [step] },
    expected: [safeStep],
  },
  {
    argv: ["jobs", "steps", "create", "Example_Build", ...stepOptions],
    method: "POST",
    path: `${jobPath}/steps`,
    body: stepBody,
    query: { fields: stepFields },
    response: step,
    expected: safeStep,
  },
  {
    argv: ["jobs", "steps", "show", "Example_Build", "RUNNER_1"],
    method: "GET",
    path: `${jobPath}/steps/RUNNER_1`,
    query: { fields: stepFields },
    response: step,
    expected: safeStep,
  },
  {
    argv: ["jobs", "steps", "replace", "Example_Build", "RUNNER_1", ...stepOptions],
    method: "PUT",
    path: `${jobPath}/steps/RUNNER_1`,
    body: stepBody,
    query: { fields: stepFields },
    response: step,
    expected: safeStep,
  },
  {
    argv: ["jobs", "steps", "delete", "Example_Build", "RUNNER_1"],
    method: "DELETE",
    path: `${jobPath}/steps/RUNNER_1`,
    response: null,
    expected: { jobId: "Example_Build", id: "RUNNER_1", deleted: true },
  },
  {
    argv: ["vcs", "roots", "list", "--project", "Example", "--limit", "2", "--start", "3"],
    method: "GET",
    path: "/vcs-roots",
    query: { fields: `vcs-root(${rootFields})`, locator: "project:(id:Example),start:3,count:2" },
    response: { "vcs-root": [root] },
    expected: [root],
  },
  {
    argv: ["vcs", "roots", "show", "Example_Git"],
    method: "GET",
    path: "/vcs-roots/id:Example_Git",
    query: { fields: rootFields },
    response: root,
    expected: root,
  },
  {
    argv: ["jobs", "vcs", "list", "Example_Build"],
    method: "GET",
    path: `${jobPath}/vcs-root-entries`,
    query: { fields: `vcs-root-entry(${entryFields})` },
    response: { "vcs-root-entry": [entry] },
    expected: [safeEntry],
  },
  {
    argv: [
      "jobs",
      "vcs",
      "attach",
      "Example_Build",
      "--root",
      "Example_Git",
      "--checkout-rules",
      "+:src=>.",
    ],
    method: "POST",
    path: `${jobPath}/vcs-root-entries`,
    body: { "vcs-root": { id: "Example_Git" }, "checkout-rules": "+:src=>." },
    query: { fields: entryFields },
    response: entry,
    expected: safeEntry,
  },
  {
    argv: ["jobs", "vcs", "show", "Example_Build", "Example_Git"],
    method: "GET",
    path: entryPath,
    query: { fields: entryFields },
    response: entry,
    expected: safeEntry,
  },
  {
    argv: [
      "jobs",
      "vcs",
      "replace",
      "Example_Build",
      "Example_Git",
      "--checkout-rules",
      "+:src=>.",
    ],
    method: "PUT",
    path: entryPath,
    body: { "vcs-root": { id: "Example_Git" }, "checkout-rules": "+:src=>." },
    query: { fields: entryFields },
    response: entry,
    expected: safeEntry,
  },
  {
    argv: ["jobs", "vcs", "detach", "Example_Build", "Example_Git"],
    method: "DELETE",
    path: entryPath,
    response: null,
    expected: { jobId: "Example_Build", rootId: "Example_Git", detached: true },
  },
  {
    argv: ["jobs", "vcs", "checkout-rules", "show", "Example_Build", "Example_Git"],
    method: "GET",
    path: `${entryPath}/checkout-rules`,
    text: true,
    response: "+:src=>.",
    expected: { jobId: "Example_Build", rootId: "Example_Git", rules: "+:src=>." },
  },
  {
    argv: [
      "jobs",
      "vcs",
      "checkout-rules",
      "set",
      "Example_Build",
      "Example_Git",
      "--rules",
      "+:src=>.",
    ],
    method: "PUT",
    path: `${entryPath}/checkout-rules`,
    text: true,
    body: "+:src=>.",
    response: "+:src=>.",
    expected: { jobId: "Example_Build", rootId: "Example_Git", rules: "+:src=>." },
  },
];
