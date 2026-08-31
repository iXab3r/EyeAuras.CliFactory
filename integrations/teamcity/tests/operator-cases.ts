import type { AuthoringCase } from "./authoring-cases.js";

const pool = { id: 1, name: "Pool" };
const agent = { id: 7, name: "Agent" };
const project = { id: "Example", name: "Example" };
const job = { id: "Example_Build", name: "Build", projectId: "Example" };
const build = { id: 42, buildTypeId: "Example_Build", state: "queued", number: "42" };
const buildFields = "id,buildTypeId,number,state,status,queuePosition";
const status = { status: true, comment: { text: "Reviewed", timestamp: "20260101T120000+0000" } };
const statusFields = "status,comment(text,timestamp)";
const buildPath = "/builds/id:42";
const agentPath = "/agents/id:7";
const poolPath = "/agentPools/id:1";
const queuePath = "/buildQueue/id:42";
export const operatorCases: AuthoringCase[] = [
  {
    argv: ["pools", "list"],
    method: "GET",
    path: "/agentPools",
    query: { locator: "start:0,count:100", fields: "agentPool(id,name)" },
    response: { agentPool: [pool] },
    expected: [pool],
  },
  {
    argv: ["pools", "create", "--name", "Pool"],
    method: "POST",
    path: "/agentPools",
    body: { name: "Pool" },
    response: pool,
    expected: pool,
  },
  {
    argv: ["pools", "show", "1"],
    method: "GET",
    path: poolPath,
    query: { fields: "id,name" },
    response: pool,
    expected: pool,
  },
  {
    argv: ["pools", "delete", "1"],
    method: "DELETE",
    path: poolPath,
    response: null,
    expected: { poolId: 1, deleted: true },
  },
  {
    argv: ["pools", "fields", "show", "1", "name"],
    method: "GET",
    path: `${poolPath}/name`,
    text: true,
    response: "Pool",
    expected: { poolId: 1, field: "name", value: "Pool" },
  },
  {
    argv: ["pools", "fields", "set", "1", "name", "Pool"],
    method: "PUT",
    path: `${poolPath}/name`,
    text: true,
    body: "Pool",
    response: "Pool",
    expected: { poolId: 1, field: "name", value: "Pool" },
  },
  {
    argv: ["pools", "agents", "list", "1"],
    method: "GET",
    path: `${poolPath}/agents`,
    query: { locator: "start:0,count:100", fields: "agent(id,name)" },
    response: { agent: [agent] },
    expected: [agent],
  },
  {
    argv: ["pools", "agents", "assign", "1", "7"],
    method: "POST",
    path: `${poolPath}/agents`,
    query: { fields: "id,name" },
    body: { id: 7 },
    response: agent,
    expected: agent,
  },
  {
    argv: ["pools", "projects", "list", "1"],
    method: "GET",
    path: `${poolPath}/projects`,
    query: { fields: "project(id,name)" },
    response: { project: [project] },
    expected: [project],
  },
  {
    argv: ["pools", "projects", "assign", "1", "Example"],
    method: "POST",
    path: `${poolPath}/projects`,
    body: { id: "Example" },
    response: project,
    expected: project,
  },
  {
    argv: ["pools", "projects", "unassign", "1", "Example"],
    method: "DELETE",
    path: `${poolPath}/projects/id:Example`,
    response: null,
    expected: { poolId: 1, projectId: "Example", unassigned: true },
  },
  {
    argv: ["agents", "delete", "7"],
    method: "DELETE",
    path: agentPath,
    response: null,
    expected: { agentId: 7, deleted: true },
  },
];
for (const [owner, group, path, id] of [
  ["agents", "enabled", `${agentPath}/enabledInfo`, "7"],
  ["agents", "authorized", `${agentPath}/authorizedInfo`, "7"],
  ["builds", "pin", `${buildPath}/pinInfo`, "42"],
]) {
  for (const method of ["GET", "PUT"] as const)
    operatorCases.push({
      argv: [
        owner!,
        group!,
        method === "GET" ? "show" : "set",
        id!,
        ...(method === "PUT" ? ["true", "--comment", "Reviewed"] : []),
      ],
      method,
      path: path!,
      query: { fields: statusFields },
      ...(method === "PUT" ? { body: { status: true, comment: { text: "Reviewed" } } } : {}),
      response: status,
      expected: status,
    });
}
const policy = { policy: "selected", buildTypes: { buildType: [job] } };
for (const method of ["GET", "PUT"] as const)
  operatorCases.push({
    argv: [
      "agents",
      "policy",
      method === "GET" ? "show" : "set",
      "7",
      ...(method === "PUT" ? ["selected", "--job", "Example_Build"] : []),
    ],
    method,
    path: `${agentPath}/compatibilityPolicy`,
    query: { fields: "policy,buildTypes(buildType(id,name,projectId))" },
    ...(method === "PUT"
      ? { body: { policy: "selected", buildTypes: { buildType: [{ id: "Example_Build" }] } } }
      : {}),
    response: policy,
    expected: { policy: "selected", jobs: [job] },
  });
for (const method of ["GET", "PUT"] as const)
  operatorCases.push({
    argv: [
      "agents",
      "pool",
      method === "GET" ? "show" : "set",
      "7",
      ...(method === "PUT" ? ["1"] : []),
    ],
    method,
    path: `${agentPath}/pool`,
    query: { fields: "id,name" },
    ...(method === "PUT" ? { body: { id: 1 } } : {}),
    response: pool,
    expected: pool,
  });
operatorCases.push(
  {
    argv: ["agents", "fields", "show", "7", "name"],
    method: "GET",
    path: `${agentPath}/name`,
    text: true,
    response: "Agent",
    expected: { agentId: 7, field: "name", value: "Agent" },
  },
  {
    argv: ["agents", "fields", "set", "7", "enabled", "true"],
    method: "PUT",
    path: `${agentPath}/enabled`,
    text: true,
    body: "true",
    response: "true",
    expected: { agentId: 7, field: "enabled", value: "true" },
  },
  {
    argv: ["agents", "compatible-jobs", "7"],
    method: "GET",
    path: `${agentPath}/compatibleBuildTypes`,
    query: { fields: "buildType(id,name,projectId)" },
    response: { buildType: [job] },
    expected: [job],
  },
  {
    argv: ["agents", "incompatible-jobs", "7"],
    method: "GET",
    path: `${agentPath}/incompatibleBuildTypes`,
    query: { fields: "compatibility(compatible,buildType(id,name,projectId))" },
    response: { compatibility: [{ compatible: false, buildType: job }] },
    expected: [{ compatible: false, buildType: job }],
  },
  {
    argv: ["queue", "show", "42"],
    method: "GET",
    path: queuePath,
    query: { fields: buildFields },
    response: build,
    expected: build,
  },
  {
    argv: ["queue", "compatible-agents", "42"],
    method: "GET",
    path: `${queuePath}/compatibleAgents`,
    query: { fields: "agent(id,name)" },
    response: { agent: [agent] },
    expected: [agent],
  },
  {
    argv: ["queue", "position", "show", "2"],
    method: "GET",
    path: "/buildQueue/order/2",
    query: { fields: buildFields },
    response: build,
    expected: build,
  },
  {
    argv: ["queue", "position", "set", "first", "--build", "42"],
    method: "PUT",
    path: "/buildQueue/order/first",
    query: { fields: buildFields },
    body: { id: 42 },
    response: build,
    expected: build,
  },
  {
    argv: ["builds", "delete", "42"],
    method: "DELETE",
    path: buildPath,
    response: null,
    expected: { buildId: 42, deleted: true },
  },
  {
    argv: ["builds", "comment", "set", "42", "--text", "Reviewed"],
    method: "PUT",
    path: `${buildPath}/comment`,
    text: true,
    body: "Reviewed",
    response: null,
    expected: { buildId: 42, commentUpdated: true },
  },
  {
    argv: ["builds", "comment", "clear", "42"],
    method: "DELETE",
    path: `${buildPath}/comment`,
    response: null,
    expected: { buildId: 42, commentCleared: true },
  },
);
for (const [field, group, value] of [
  ["number", "number", "42"],
  ["statusText", "status-text", "Building"],
]) {
  for (const method of ["GET", "PUT"] as const)
    operatorCases.push({
      argv: [
        "builds",
        group!,
        method === "GET" ? "show" : "set",
        "42",
        ...(method === "PUT" ? [value!] : []),
      ],
      method,
      path: `${buildPath}/${field}`,
      text: true,
      ...(method === "PUT" ? { body: value } : {}),
      response: value,
      expected: { buildId: 42, field, value },
    });
}
for (const [field, group, value] of [
  ["status", "status", "SUCCESS"],
  ["finishDate", "finish-date", "20260101T120000+0000"],
  ["buildTypeId", "fields", "Example_Build"],
])
  operatorCases.push({
    argv: [
      "builds",
      group!,
      ...(group === "fields" ? ["show"] : []),
      "42",
      ...(group === "fields" ? [field!] : []),
    ],
    method: "GET",
    path: `${buildPath}/${field}`,
    text: true,
    response: value,
    expected: { buildId: 42, field, value },
  });
for (const owner of ["builds", "queue"] as const) {
  const path = owner === "builds" ? buildPath : queuePath;
  for (const method of (owner === "builds" ? ["GET", "POST", "PUT"] : ["GET", "POST"]) as (
    | "GET"
    | "POST"
    | "PUT"
  )[]) {
    operatorCases.push({
      argv: [
        owner,
        "tags",
        method === "GET" ? "list" : method === "POST" ? "add" : "replace",
        "42",
        ...(method === "GET" ? [] : ["--tag", "release"]),
      ],
      method,
      path: `${path}/tags`,
      ...(method === "POST" ? {} : { query: { fields: "tag(name)" } }),
      ...(method === "GET" ? {} : { body: { tag: [{ name: "release" }] } }),
      response: method === "POST" ? null : { tag: [{ name: "release" }] },
      expected: method === "POST" ? { buildId: 42, tags: ["release"], added: true } : ["release"],
    });
  }
}
const change = {
  id: 9,
  version: "revision",
  date: "20260101T120000+0000",
  comment: "Example change",
};
operatorCases.push(
  {
    argv: ["builds", "statistics", "list", "42"],
    method: "GET",
    path: `${buildPath}/statistics`,
    query: { fields: "property(name,value)" },
    response: { property: [{ name: "Duration", value: "12345" }] },
    expected: [{ name: "Duration", value: "12345" }],
  },
  {
    argv: ["builds", "statistics", "show", "42", "Duration"],
    method: "GET",
    path: `${buildPath}/statistics/Duration`,
    text: true,
    response: "12345",
    expected: { name: "Duration", value: "12345" },
  },
  {
    argv: ["builds", "canceled-info", "42"],
    method: "GET",
    path: `${buildPath}/canceledInfo`,
    query: { fields: "text,timestamp" },
    response: status.comment,
    expected: status.comment,
  },
  {
    argv: ["changes", "show", "9"],
    method: "GET",
    path: "/changes/id:9",
    query: { fields: "id,version,date,comment" },
    response: change,
    expected: change,
  },
  {
    argv: ["changes", "parents", "9"],
    method: "GET",
    path: "/changes/id:9/parentChanges",
    query: { fields: "change(id,version,date,comment)" },
    response: { change: [change] },
    expected: [change],
  },
);
