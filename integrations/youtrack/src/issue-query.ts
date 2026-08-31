import {
  encodedID,
  fields,
  mutate,
  page,
  readCollection,
  readObject,
  requiredText,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

export interface AssistOptions extends ProjectionOptions {
  query: string;
  caret?: number;
}

export interface CommandAssistOptions extends AssistOptions {
  issues?: readonly string[];
}

const suggestions = "suggestions(option,description,caret,completionStart,completionEnd)";
const savedQueryFields = "id,name,query,owner(id,login)";

function selectedIssues(ids: readonly string[]): YouTrackObject[] {
  if (ids.length < 1 || ids.length > 20 || new Set(ids).size !== ids.length) {
    throw new Error("YouTrack issues must contain 1–20 distinct explicit issue IDs.");
  }
  return ids.map((id) => {
    requiredText(id, "issue ID");
    if (/^\d+-\d+$/.test(id)) {
      return { id };
    }
    if (/^[^\s,]+-\d+$/.test(id)) {
      return { idReadable: id };
    }
    throw new Error("YouTrack issues require database IDs (2-7) or readable IDs (DEMO-1), not a search query.");
  });
}

export function parseIssueSelection(value: string): string[] {
  const ids = value.split(",").map((id) => id.trim());
  selectedIssues(ids);
  return ids;
}

function queryBody(options: AssistOptions): YouTrackObject {
  const query = requiredText(options.query, "query");
  if (
    options.caret !== undefined &&
    (
      !Number.isSafeInteger(options.caret) ||
      options.caret < 0 ||
      options.caret > query.length
    )
  ) {
    throw new Error("YouTrack caret must be an integer between zero and the query length.");
  }
  return {
    query,
    ...(options.caret === undefined ? {} : { caret: options.caret }),
  };
}

function suggestionsResult(
  value: YouTrackObject,
  options: ProjectionOptions,
): YouTrackObject {
  if (
    (options.fields === undefined || Object.hasOwn(value, "suggestions")) &&
    (
      !Array.isArray(value.suggestions) ||
      value.suggestions.some((item) =>
        item === null || typeof item !== "object" || Array.isArray(item)
      )
    )
  ) {
    throw new Error("YouTrack returned invalid suggestions.");
  }
  return value;
}

export async function applyCommands(
  connection: Connection,
  query: string,
  issues: readonly string[],
  options: ProjectionOptions = {},
): Promise<YouTrackObject | null> {
  return mutate(
    connection,
    "api/commands",
    {
      query: requiredText(query, "query"),
      issues: selectedIssues(issues),
    },
    fields(options, "query,issues(id,idReadable)"),
  );
}

export async function assistCommands(
  connection: Connection,
  options: CommandAssistOptions,
): Promise<YouTrackObject> {
  return suggestionsResult(
    await readObject(
      connection,
      "api/commands/assist",
      {
        fields: fields(options, `query,caret,commands(description,error,delete),${suggestions}`),
      },
      {
        ...queryBody(options),
        ...(options.issues === undefined ? {} : { issues: selectedIssues(options.issues) }),
      },
    ),
    options,
  );
}

export async function assistSearch(
  connection: Connection,
  options: AssistOptions,
): Promise<YouTrackObject> {
  return suggestionsResult(
    await readObject(
      connection,
      "api/search/assist",
      { fields: fields(options, `query,caret,${suggestions}`) },
      queryBody(options),
    ),
    options,
  );
}

export async function countIssues(
  connection: Connection,
  query: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  const value = await readObject(
    connection,
    "api/issuesGetter/count",
    { fields: fields(options, "count") },
    { query: requiredText(query, "query") },
  );
  if (
    (options.fields === undefined || Object.hasOwn(value, "count")) &&
    value.count !== null &&
    (
      typeof value.count !== "number" ||
      !Number.isSafeInteger(value.count) ||
      value.count < -1
    )
  ) {
    throw new Error("YouTrack returned an invalid issue count.");
  }
  return value;
}

export async function listSavedQueries(
  connection: Connection,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, "api/savedQueries", page(options, savedQueryFields));
}

export async function getSavedQuery(
  connection: Connection,
  queryID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(connection, `api/savedQueries/${encodedID(queryID, "saved query ID")}`, {
    fields: fields(options, savedQueryFields),
  });
}
