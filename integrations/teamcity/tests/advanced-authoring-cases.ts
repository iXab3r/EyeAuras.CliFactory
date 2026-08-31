import type { AuthoringCase } from "./authoring-cases.js";

const job = "/buildTypes/id:Example_Build";
const project = "/projects/id:Example";
const propertyFields = "name,value,inherited,type(rawValue)";
const entityFields = `id,type,disabled,inherited,properties(property(${propertyFields}))`;
const identityFields = "id,name,projectId";
export const advancedAuthoringCases: AuthoringCase[] = [];

for (const kind of ["agent-requirements", "artifact-dependencies", "projectFeatures"]) {
  const isProject = kind === "projectFeatures";
  const artifact = kind === "artifact-dependencies";
  const path = `${isProject ? project : job}/${kind}`;
  const prefix = isProject ? ["projects", "features"] : ["jobs", kind];
  const owner = isProject ? "Example" : "Example_Build";
  const key = isProject ? "projectFeature" : artifact ? "artifact-dependency" : "agent-requirement";
  const fields = entityFields + (artifact ? `,source-buildType(${identityFields})` : "");
  const body = isProject
    ? { type: "plugin", properties: { property: [] } }
    : artifact
      ? {
          type: "artifact_dependency",
          disabled: false,
          "source-buildType": { id: "Source" },
          properties: {
            property: [
              { name: "pathRules", value: "*.zip=>dist" },
              { name: "revisionName", value: "lastSuccessful" },
              { name: "cleanDestinationDirectory", value: "false" },
            ],
          },
        }
      : {
          type: "equals",
          disabled: false,
          properties: {
            property: [
              { name: "property-name", value: "env.MODE" },
              { name: "property-value", value: "debug" },
            ],
          },
        };
  const options = isProject
    ? ["--type", "plugin"]
    : artifact
      ? ["--source", "Source", "--rules", "*.zip=>dist", "--revision", "lastSuccessful"]
      : ["--type", "equals", "--parameter", "env.MODE", "--value", "debug"];
  const response = { id: "Entity", ...body };
  const expected = {
    id: "Entity",
    type: body.type,
    ...(!isProject ? { disabled: false } : {}),
    ...(artifact ? { source: { id: "Source" } } : {}),
    properties: body.properties.property.map(({ name }) => ({
      name,
      type: "plain",
      redacted: true,
    })),
  };
  advancedAuthoringCases.push(
    {
      argv: [...prefix, "list", owner],
      method: "GET",
      path,
      query: { fields: `${key}(${fields})` },
      response: { [key]: [response] },
      expected: [expected],
    },
    {
      argv: [...prefix, "show", owner, "Entity"],
      method: "GET",
      path: `${path}/id:Entity`,
      query: { fields },
      response,
      expected,
    },
    {
      argv: [...prefix, "create", owner, ...options],
      method: "POST",
      path,
      query: { fields },
      body,
      response,
      expected,
    },
    {
      argv: [...prefix, "replace", owner, "Entity", ...options],
      method: "PUT",
      path: `${path}/id:Entity`,
      query: { fields },
      body,
      response,
      expected,
    },
    {
      argv: [...prefix, "delete", owner, "Entity"],
      method: "DELETE",
      path: `${path}/id:Entity`,
      response: null,
      expected: { ownerId: owner, id: "Entity", deleted: true },
    },
  );
}
for (const kind of [
  "steps",
  "features",
  "triggers",
  "agent-requirements",
  "artifact-dependencies",
]) {
  const segment =
    kind === "agent-requirements" || kind === "artifact-dependencies" ? "id:Entity" : "Entity";
  const path = `${job}/${kind}/${segment}`;
  for (const [method, action] of [
    ["GET", "show"],
    ["PUT", "set"],
  ] as const) {
    advancedAuthoringCases.push({
      argv: [
        "jobs",
        kind,
        "fields",
        action,
        "Example_Build",
        "Entity",
        "disabled",
        ...(method === "PUT" ? ["true"] : []),
      ],
      method,
      path: `${path}/disabled`,
      text: true,
      ...(method === "PUT" ? { body: "true" } : {}),
      response: "true",
      expected: { jobId: "Example_Build", id: "Entity", field: "disabled", value: "true" },
    });
  }
  if (kind !== "steps" && kind !== "features") continue;
  const property = { name: "example.setting", value: "synthetic-hidden" };
  const expected = { name: property.name, type: "plain", redacted: true };
  advancedAuthoringCases.push(
    {
      argv: ["jobs", kind, "parameters", "list", "Example_Build", "Entity"],
      method: "GET",
      path: `${path}/parameters`,
      query: { fields: `property(${propertyFields})` },
      response: { property: [property] },
      expected: [expected],
    },
    {
      argv: [
        "jobs",
        kind,
        "parameters",
        "replace",
        "Example_Build",
        "Entity",
        "--property",
        "example.setting=synthetic-hidden",
      ],
      method: "PUT",
      path: `${path}/parameters`,
      query: { fields: `property(${propertyFields})` },
      body: { property: [property] },
      response: { property: [property] },
      expected: [expected],
    },
    {
      argv: ["jobs", kind, "parameters", "show", "Example_Build", "Entity", property.name],
      method: "GET",
      path: `${path}/parameters/${property.name}`,
      text: true,
      response: property.value,
      expected,
    },
    {
      argv: [
        "jobs",
        kind,
        "parameters",
        "set",
        "Example_Build",
        "Entity",
        property.name,
        property.value,
      ],
      method: "PUT",
      path: `${path}/parameters/${property.name}`,
      text: true,
      body: property.value,
      response: property.value,
      expected,
    },
  );
}
const property = { name: "env.MODE", value: "debug", type: { rawValue: "text" } };
const safe = { name: "env.MODE", value: "debug", type: "text", redacted: false };
const output = `${job}/output-parameters`;
advancedAuthoringCases.push(
  {
    argv: ["jobs", "output-parameters", "list", "Example_Build"],
    method: "GET",
    path: output,
    query: { fields: `property(${propertyFields})` },
    response: { property: [property] },
    expected: [safe],
  },
  {
    argv: ["jobs", "output-parameters", "show", "Example_Build", "env.MODE"],
    method: "GET",
    path: `${output}/env.MODE`,
    query: { fields: propertyFields },
    response: property,
    expected: safe,
  },
  ...(["POST", "PUT"] as const).map(
    (method): AuthoringCase => ({
      argv: [
        "jobs",
        "output-parameters",
        method === "POST" ? "create" : "set",
        "Example_Build",
        "env.MODE",
        "--value",
        "debug",
      ],
      method,
      path: method === "POST" ? output : `${output}/env.MODE`,
      query: { fields: propertyFields },
      body: { name: "env.MODE", value: "debug" },
      response: property,
      expected: safe,
      preflight: `${output}/env.MODE`,
    }),
  ),
  {
    argv: ["jobs", "output-parameters", "delete", "Example_Build", "env.MODE"],
    method: "DELETE",
    path: `${output}/env.MODE`,
    response: null,
    expected: { owner: "output", id: "Example_Build", name: "env.MODE", deleted: true },
  },
);
const template = { id: "Template", name: "Template", projectId: "Example" };
advancedAuthoringCases.push(
  {
    argv: ["projects", "templates", "list", "Example"],
    method: "GET",
    path: `${project}/templates`,
    query: { fields: `buildType(${identityFields})` },
    response: { buildType: [template] },
    expected: [template],
  },
  {
    argv: ["projects", "templates", "create", "Example", "Template", "--name", "Template"],
    method: "POST",
    path: `${project}/templates`,
    query: { fields: identityFields },
    body: { id: "Template", name: "Template" },
    response: template,
    expected: template,
  },
  {
    argv: ["projects", "templates", "default", "show", "Example"],
    method: "GET",
    path: `${project}/defaultTemplate`,
    query: { fields: identityFields },
    response: template,
    expected: template,
  },
  {
    argv: ["projects", "templates", "default", "set", "Example", "--template", "Template"],
    method: "PUT",
    path: `${project}/defaultTemplate`,
    query: { fields: identityFields },
    body: { id: "Template" },
    response: template,
    expected: template,
  },
  {
    argv: ["projects", "templates", "default", "clear", "Example"],
    method: "DELETE",
    path: `${project}/defaultTemplate`,
    response: null,
    expected: { projectId: "Example", cleared: true },
  },
  {
    argv: ["jobs", "templates", "show", "Example_Build", "Template"],
    method: "GET",
    path: `${job}/templates/id:Template`,
    query: { fields: identityFields },
    response: template,
    expected: template,
  },
  {
    argv: ["projects", "parent", "Example"],
    method: "GET",
    path: `${project}/parentProject`,
    query: { fields: "id,name" },
    response: { id: "Parent", name: "Parent" },
    expected: { id: "Parent", name: "Parent" },
  },
  {
    argv: ["projects", "fields", "show", "Example", "name"],
    method: "GET",
    path: `${project}/name`,
    text: true,
    response: "Example",
    expected: { id: "Example", field: "name", value: "Example" },
  },
  {
    argv: ["jobs", "fields", "show", "Example_Build", "paused"],
    method: "GET",
    path: `${job}/paused`,
    text: true,
    response: "false",
    expected: { id: "Example_Build", field: "paused", value: "false" },
  },
  {
    argv: ["jobs", "aliases", "Example_Build"],
    method: "GET",
    path: `${job}/aliases`,
    response: { item: ["OldId"] },
    expected: ["OldId"],
  },
  {
    argv: ["jobs", "branches", "Example_Build"],
    method: "GET",
    path: `${job}/branches`,
    query: { locator: "start:0,count:100", fields: "branch(name,default,active)" },
    response: { branch: [{ name: "main", default: true, active: true }] },
    expected: [{ name: "main", default: true, active: true }],
  },
  {
    argv: ["jobs", "tags", "Example_Build"],
    method: "GET",
    path: `${job}/buildTags`,
    query: { field: "tag(name)" },
    response: { tag: [{ name: "release" }] },
    expected: ["release"],
  },
);
