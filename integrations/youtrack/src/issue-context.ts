import {
  encodedID,
  fields,
  issuePath,
  mutate,
  mutationBody,
  narrative,
  page,
  readCollection,
  readObject,
  requiredText,
  type Connection,
  type PageOptions,
  type ProjectionOptions,
  type YouTrackObject,
} from "./client.js";

export interface ActivityOptions extends ProjectionOptions {
  categories: string;
  cursor?: string;
  reverse?: boolean;
}

const activityFields =
  "id,beforeCursor,afterCursor,hasBefore,hasAfter,reverse,activities(id,$type,timestamp,author(id,login),category(id))";
const commentFields = "id,text,author(id,login),created,updated";
const vcsFields = "id,$type,date,fetched,text,author(login)";

export function activityCategories(value: string): string {
  requiredText(value, "categories");
  if (value.split(",").some((category) => !category.trim())) {
    throw new Error("YouTrack categories must contain nonempty comma-separated category IDs.");
  }
  return value;
}

function activityQuery(options: ActivityOptions): Record<string, string> {
  if (options.reverse !== undefined && typeof options.reverse !== "boolean") {
    throw new Error("YouTrack reverse must be boolean.");
  }
  return {
    fields: fields(options, activityFields),
    categories: activityCategories(options.categories),
    ...(options.cursor === undefined ? {} : { cursor: requiredText(options.cursor, "cursor") }),
    ...(options.reverse === undefined ? {} : { reverse: String(options.reverse) }),
  };
}

async function activityPage(
  connection: Connection,
  path: string,
  options: ActivityOptions,
): Promise<YouTrackObject> {
  const result = await readObject(connection, path, activityQuery(options));
  if (
    options.fields === undefined &&
    ["activities", "beforeCursor", "afterCursor", "hasBefore", "hasAfter", "reverse"]
      .some((key) => !Object.hasOwn(result, key))
  ) {
    throw new Error("YouTrack returned an invalid activity page.");
  }
  if (
    result.activities !== undefined &&
    (!Array.isArray(result.activities) || result.activities.some(
      (item) => item === null || typeof item !== "object" || Array.isArray(item),
    ))
  ) {
    throw new Error("YouTrack returned an invalid activity page.");
  }
  for (const key of ["beforeCursor", "afterCursor"]) {
    if (result[key] !== undefined && typeof result[key] !== "string") {
      throw new Error("YouTrack returned an invalid activity page.");
    }
  }
  for (const key of ["hasBefore", "hasAfter", "reverse"]) {
    if (result[key] !== undefined && typeof result[key] !== "boolean") {
      throw new Error("YouTrack returned an invalid activity page.");
    }
  }
  return result;
}

export async function getActivitiesPage(
  connection: Connection,
  options: ActivityOptions,
): Promise<YouTrackObject> {
  return activityPage(connection, "api/activitiesPage", options);
}

export async function getIssueActivitiesPage(
  connection: Connection,
  issueID: string,
  options: ActivityOptions,
): Promise<YouTrackObject> {
  return activityPage(connection, `${issuePath(issueID)}/activitiesPage`, options);
}

export async function getComment(
  connection: Connection,
  issueID: string,
  commentID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `${issuePath(issueID)}/comments/${encodedID(commentID, "comment ID")}`,
    { fields: fields(options, commentFields) },
  );
}

export async function updateComment(
  connection: Connection,
  issueID: string,
  commentID: string,
  input: unknown,
): Promise<YouTrackObject | null> {
  const body = mutationBody(input, ["text"]);
  return mutate(
    connection,
    `${issuePath(issueID)}/comments/${encodedID(commentID, "comment ID")}`,
    { text: narrative(body.text, "text") },
    commentFields,
  );
}

export async function listIssueSprints(
  connection: Connection,
  issueID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(
    connection,
    `${issuePath(issueID)}/sprints`,
    page(options, "id,name,goal,start,finish,archived,agile(id,name)"),
  );
}

export async function listVcsChanges(
  connection: Connection,
  issueID: string,
  options: PageOptions = {},
): Promise<YouTrackObject[]> {
  return readCollection(connection, `${issuePath(issueID)}/vcsChanges`, page(options, vcsFields));
}

export async function getVcsChange(
  connection: Connection,
  issueID: string,
  changeID: string,
  options: ProjectionOptions = {},
): Promise<YouTrackObject> {
  return readObject(
    connection,
    `${issuePath(issueID)}/vcsChanges/${encodedID(changeID, "change ID")}`,
    { fields: fields(options, vcsFields) },
  );
}
