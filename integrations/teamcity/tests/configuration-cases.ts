import type { AuthoringCase } from "./authoring-cases.js";

// Synthetic examples of the official REST contract; never import production field selectors.
const entityFields =
  "id,type,disabled,inherited,properties(property(name,value,inherited,type(rawValue)))";
const job = "/buildTypes/id:Example_Build";
export const configurationCases: AuthoringCase[] = [];

for (const family of [
  { group: "triggers", key: "trigger", id: "TRIGGER_1", type: "vcsTrigger" },
  { group: "features", key: "feature", id: "FEATURE_1", type: "swabra" },
  {
    group: "snapshot-dependencies",
    key: "snapshot-dependency",
    id: "Example_Compile",
    type: "snapshot_dependency",
  },
]) {
  const dependency = family.group === "snapshot-dependencies";
  const source = { id: "Example_Compile" };
  const fields = entityFields + (dependency ? ",source-buildType(id,name,projectId)" : "");
  const properties = { property: [{ name: "example.setting", value: "a=b" }] };
  const body = dependency
    ? { type: family.type, "source-buildType": source, properties }
    : { type: family.type, disabled: true, properties };
  const response = { id: family.id, ...body, inherited: false };
  const expected = {
    id: family.id,
    type: family.type,
    inherited: false,
    ...(dependency ? { source } : { disabled: true }),
    properties: [{ name: "example.setting", type: "plain", redacted: true }],
  };
  const prefix = ["jobs", family.group];
  const options = [
    ...(dependency ? ["--source", source.id] : ["--type", family.type]),
    "--property",
    "example.setting=a=b",
  ];
  const path = `${job}/${family.group}`;
  configurationCases.push(
    {
      argv: [...prefix, "list", "Example_Build"],
      method: "GET",
      path,
      query: { fields: `${family.key}(${fields})` },
      response: { [family.key]: [response] },
      expected: [expected],
    },
    {
      argv: [...prefix, "show", "Example_Build", family.id],
      method: "GET",
      path: `${path}/${family.id}`,
      query: { fields },
      response,
      expected,
    },
    {
      argv: [...prefix, "create", "Example_Build", ...options],
      method: "POST",
      path,
      query: { fields },
      body,
      response,
      expected,
    },
    {
      argv: [...prefix, "replace", "Example_Build", family.id, ...options],
      method: "PUT",
      path: `${path}/${family.id}`,
      query: { fields },
      body,
      response,
      expected,
    },
    {
      argv: [...prefix, "delete", "Example_Build", family.id],
      method: "DELETE",
      path: `${path}/${family.id}`,
      response: null,
      expected: { jobId: "Example_Build", id: family.id, deleted: true },
    },
  );
}

const template = { id: "Example_Template", name: "Template", projectId: "Example" };
configurationCases.push(
  {
    argv: ["jobs", "templates", "list", "Example_Build"],
    method: "GET",
    path: `${job}/templates`,
    query: { fields: "buildType(id,name,projectId)" },
    response: { buildType: [template] },
    expected: [template],
  },
  {
    argv: ["jobs", "templates", "attach", "Example_Build", "--template", template.id],
    method: "POST",
    path: `${job}/templates`,
    query: { fields: "id,name,projectId", optimizeSettings: "false" },
    body: { id: template.id },
    response: template,
    expected: template,
  },
  {
    argv: ["jobs", "templates", "detach", "Example_Build", template.id],
    method: "DELETE",
    path: `${job}/templates/id:Example_Template`,
    query: { inlineSettings: "false" },
    response: null,
    expected: {
      jobId: "Example_Build",
      templateId: template.id,
      detached: true,
      inlineSettings: false,
    },
  },
);
