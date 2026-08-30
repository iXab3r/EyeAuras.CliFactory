import type { AuthoringCase } from "./authoring-cases.js";

// Independent synthetic contracts derived from the official 2026.1 reference.
export const bulkConfigurationCases: AuthoringCase[] = [];
const cases = bulkConfigurationCases;
const property = { name: "env.MODE", value: "debug" };
const safeProperty = { ...property, type: "plain", redacted: false };
const job = { id: "Build", name: "Build", projectId: "Example" };
const project = { id: "Example", name: "Example" };
const pool = { id: 1, name: "Pool" };
for (const owner of ["jobs", "projects", "output"] as const) {
  const root = owner === "projects" ? "/projects/id:Example" : "/buildTypes/id:Build";
  const id = owner === "projects" ? "Example" : "Build";
  const group = owner === "output" ? "output-parameters" : "parameters";
  const command = [owner === "projects" ? "projects" : "jobs", group];
  const path = `${root}/${group}`;
  cases.push({
    argv: [...command, "replace-all", id, "--property", "env.MODE=debug"],
    method: "PUT",
    path,
    query: { fields: "property(name,value,inherited,type(rawValue))" },
    body: { property: [property] },
    response: { property: [property] },
    expected: [safeProperty],
    preflight: path,
    preflightFields: "property(name,inherited,type(rawValue))",
    preflightResponse: { property: [{ name: "env.MODE", type: { rawValue: "text" } }] },
  });
  cases.push({
    argv: [...command, "clear", id, "--confirm"],
    method: "DELETE",
    path,
    response: null,
    expected: { ownerId: id, cleared: true },
  });
  for (const part of owner === "output" ? ["value"] : ["value", "type", "type/rawValue"]) {
    const cmd = part === "type/rawValue" ? "raw-type" : part;
    for (const method of ["GET", "PUT"] as const) {
      const value = part === "value" ? "debug" : "text";
      cases.push({
        argv: [
          ...command,
          cmd,
          method === "GET" ? "show" : "set",
          id,
          "env.MODE",
          ...(method === "PUT" ? [value] : []),
        ],
        method,
        path: `${path}/env.MODE/${part}`,
        text: part !== "type",
        ...(method === "PUT" ? { body: part === "type" ? { rawValue: value } : value } : {}),
        response: part === "type" ? { rawValue: value } : value,
        expected:
          part === "value"
            ? { ...property, type: "text", redacted: false }
            : { name: "env.MODE", type: "text", redacted: false },
        preflight: `${path}/env.MODE`,
      });
    }
  }
}
for (const [kind, group, key, input, body, fields, response, expected] of [
  [
    "steps",
    "steps",
    "step",
    { name: "Echo", type: "simpleRunner" },
    { name: "Echo", type: "simpleRunner", properties: { property: [] } },
    "id,name,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue)))",
    { id: "Runner", name: "Echo", type: "simpleRunner" },
    { id: "Runner", name: "Echo", type: "simpleRunner", properties: [] },
  ],
  [
    "features",
    "features",
    "feature",
    { type: "swabra" },
    { type: "swabra", disabled: true, properties: { property: [] } },
    "id,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue)))",
    { id: "Feature", type: "swabra", disabled: true },
    { id: "Feature", type: "swabra", disabled: true, properties: [] },
  ],
  [
    "triggers",
    "triggers",
    "trigger",
    { type: "vcsTrigger" },
    { type: "vcsTrigger", disabled: true, properties: { property: [] } },
    "id,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue)))",
    { id: "Trigger", type: "vcsTrigger", disabled: true },
    { id: "Trigger", type: "vcsTrigger", disabled: true, properties: [] },
  ],
  [
    "agent-requirements",
    "agent-requirements",
    "agent-requirement",
    { type: "exists", parameter: "env.MODE" },
    {
      type: "exists",
      disabled: false,
      properties: { property: [{ name: "property-name", value: "env.MODE" }] },
    },
    "id,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue)))",
    { id: "Requirement", type: "exists" },
    { id: "Requirement", type: "exists", properties: [] },
  ],
  [
    "artifact-dependencies",
    "artifact-dependencies",
    "artifact-dependency",
    { source: "Source", rules: "*.zip", revision: "lastSuccessful" },
    {
      type: "artifact_dependency",
      disabled: false,
      "source-buildType": { id: "Source" },
      properties: {
        property: [
          { name: "pathRules", value: "*.zip" },
          { name: "revisionName", value: "lastSuccessful" },
          { name: "cleanDestinationDirectory", value: "false" },
        ],
      },
    },
    "id,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue))),source-buildType(id,name,projectId)",
    { id: "Dependency", type: "artifact_dependency", "source-buildType": { id: "Source" } },
    { id: "Dependency", type: "artifact_dependency", properties: [], source: { id: "Source" } },
  ],
  [
    "snapshot-dependencies",
    "snapshot-dependencies",
    "snapshot-dependency",
    { source: "Source" },
    {
      type: "snapshot_dependency",
      "source-buildType": { id: "Source" },
      properties: { property: [] },
    },
    "id,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue))),source-buildType(id,name,projectId)",
    { id: "Source", type: "snapshot_dependency", "source-buildType": { id: "Source" } },
    { id: "Source", type: "snapshot_dependency", properties: [], source: { id: "Source" } },
  ],
  [
    "vcs-root-entries",
    "vcs",
    "vcs-root-entry",
    { rootId: "Git", rules: "+:." },
    { "vcs-root": { id: "Git" }, "checkout-rules": "+:." },
    "vcs-root(id,name,vcsName,project(id,name)),checkout-rules",
    { "vcs-root": { id: "Git", name: "Git" }, "checkout-rules": "+:." },
    { root: { id: "Git", name: "Git" }, rules: "+:." },
  ],
] as const)
  cases.push({
    argv: ["jobs", group, "replace-all", "Build", "--item", JSON.stringify(input)],
    method: "PUT",
    path: `/buildTypes/id:Build/${kind}`,
    query: { fields: `${key}(${fields})` },
    body: { [key]: [body] },
    response: { [key]: [response] },
    expected: [expected],
  });
cases.push(
  {
    argv: ["jobs", "templates", "replace-all", "Build", "--template", "Template"],
    method: "PUT",
    path: "/buildTypes/id:Build/templates",
    query: { fields: "buildType(id,name,projectId)", optimizeSettings: "false" },
    body: { buildType: [{ id: "Template" }] },
    response: { buildType: [{ id: "Template" }] },
    expected: [{ id: "Template" }],
  },
  {
    argv: ["jobs", "templates", "clear", "Build", "--confirm"],
    method: "DELETE",
    path: "/buildTypes/id:Build/templates",
    query: { inlineSettings: "false" },
    response: null,
    expected: { jobId: "Build", cleared: true },
  },
  {
    argv: ["jobs", "builds", "Build"],
    method: "GET",
    path: "/buildTypes/id:Build/builds",
    query: { fields: "build(id,buildTypeId,number,state,status,queuePosition)" },
    response: { build: [{ id: 42 }] },
    expected: [{ id: 42 }],
  },
);
for (const method of ["GET", "POST", "PUT"] as const)
  cases.push({
    argv: [
      "projects",
      "pools",
      method === "GET" ? "list" : method === "POST" ? "assign" : "replace-all",
      "Example",
      ...(method === "GET" ? [] : method === "POST" ? ["1"] : ["--pool", "1"]),
    ],
    method,
    path: "/projects/id:Example/agentPools",
    query: { fields: method === "POST" ? "id,name" : "agentPool(id,name)" },
    ...(method === "GET"
      ? {}
      : { body: method === "POST" ? { id: 1 } : { agentPool: [{ id: 1 }] } }),
    response: method === "POST" ? pool : { agentPool: [pool] },
    expected: method === "POST" ? pool : [pool],
  });
cases.push(
  {
    argv: ["projects", "pools", "unassign", "Example", "1"],
    method: "DELETE",
    path: "/projects/id:Example/agentPools/id:1",
    response: null,
    expected: { projectId: "Example", poolId: 1, unassigned: true },
  },
  {
    argv: ["projects", "branches", "Example"],
    method: "GET",
    path: "/projects/id:Example/branches",
    query: { locator: "start:0,count:100", fields: "branch(name,default)" },
    response: { branch: [{ name: "main", default: true }] },
    expected: [{ name: "main", default: true }],
  },
  {
    argv: ["projects", "jobs", "create", "Example", "Build", "--name", "Build"],
    method: "POST",
    path: "/projects/id:Example/buildTypes",
    query: { fields: "id,name,projectId" },
    body: { id: "Build", name: "Build" },
    response: job,
    expected: job,
  },
);
for (const [group, path, key, item] of [
  ["jobs", "buildTypes", "buildType", job],
  ["projects", "projects", "project", project],
] as const) {
  for (const method of ["GET", "PUT"] as const)
    cases.push({
      argv: [
        "projects",
        "order",
        group,
        method === "GET" ? "show" : "set",
        "Example",
        ...(method === "PUT" ? ["--id", item.id] : []),
      ],
      method,
      path: `/projects/id:Example/order/${path}`,
      query: { field: `${key}(id,name${group === "jobs" ? ",projectId" : ""})` },
      ...(method === "PUT" ? { body: { [key]: [{ id: item.id }] } } : {}),
      response: { [key]: [item] },
      expected: [item],
    });
}
cases.push(
  {
    argv: ["projects", "features", "replace-all", "Example", "--item", '{"type":"exampleFeature"}'],
    method: "PUT",
    path: "/projects/id:Example/projectFeatures",
    query: {
      fields:
        "projectFeature(id,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue))))",
    },
    body: { projectFeature: [{ type: "exampleFeature", properties: { property: [] } }] },
    response: { projectFeature: [{ id: "Feature", type: "exampleFeature" }] },
    expected: [{ id: "Feature", type: "exampleFeature", properties: [] }],
  },
  {
    argv: ["pools", "projects", "replace-all", "1", "--project", "Example"],
    method: "PUT",
    path: "/agentPools/id:1/projects",
    query: { fields: "project(id,name)" },
    body: { project: [{ id: "Example" }] },
    response: { project: [project] },
    expected: [project],
  },
  {
    argv: ["pools", "projects", "clear", "1", "--confirm"],
    method: "DELETE",
    path: "/agentPools/id:1/projects",
    response: null,
    expected: { poolId: 1, cleared: true },
  },
  {
    argv: ["queue", "delete-page", "--job", "Build", "--confirm"],
    method: "DELETE",
    path: "/buildQueue",
    query: { locator: "buildType:(id:Build),start:0,count:100" },
    response: null,
    expected: { jobId: "Build", pageDeleted: true },
  },
  {
    argv: ["queue", "reorder", "--build", "42"],
    method: "PUT",
    path: "/buildQueue/order",
    query: { fields: "build(id,buildTypeId,number,state,status,queuePosition)" },
    body: { build: [{ id: 42 }] },
    response: { build: [{ id: 42 }] },
    expected: [{ id: 42 }],
  },
  {
    argv: ["queue", "paused", "set", "true", "--reason", "Maintenance"],
    method: "PUT",
    path: "/buildQueue/pausedState",
    body: { paused: true, reason: "Maintenance" },
    response: null,
    expected: { paused: true, updated: true },
  },
  {
    argv: ["queue", "approval", "show", "42"],
    method: "GET",
    path: "/buildQueue/id:42/approvalInfo",
    query: { fields: "status,canBeApprovedByCurrentUser,configurationValid,timeoutTimestamp" },
    response: { status: "waitingForApproval", canBeApprovedByCurrentUser: true },
    expected: { status: "waitingForApproval", canBeApprovedByCurrentUser: true },
  },
  {
    argv: ["queue", "approval", "approve", "42"],
    method: "POST",
    path: "/buildQueue/id:42/approve",
    query: {
      fields: "status,canBeApprovedByCurrentUser,configurationValid,timeoutTimestamp",
      approveAll: "false",
    },
    response: { status: "approved" },
    expected: { status: "approved" },
  },
  {
    argv: ["queue", "delete", "42"],
    method: "DELETE",
    path: "/buildQueue/id:42",
    response: null,
    expected: { buildId: 42, deleted: true },
  },
  {
    argv: ["agents", "types", "show", "7"],
    method: "GET",
    path: "/agentTypes/id:7",
    query: { fields: "id,name,isCloud" },
    response: { id: 7, name: "Type", isCloud: false },
    expected: { id: 7, name: "Type", isCloud: false },
  },
);
