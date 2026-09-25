import { readResponseBody } from "@eyeauras/cli-factory";

export interface YouTrackUser {
  id: string;
  login: string;
}

export interface Connection {
  baseUrl: string;
  token: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

export function youTrackUrl(value: unknown): string {
  const message =
    "YouTrack URL must be an HTTPS server URL with an optional context path, " +
    "without credentials, query, fragment or appended /api (HTTP is allowed only on localhost).";
  if (typeof value !== "string" || /[\\\u0000-\u0020\u007f]/.test(value.trim())) {
    throw new Error(message);
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(message);
  }
  const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname).replace(/\/+$/, "");
  } catch {
    throw new Error(message);
  }
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && localhost)) ||
    url.username || url.password || url.search || url.hash || /\/api$/i.test(pathname) ||
    value.includes("?") || value.includes("#")
  ) {
    throw new Error(message);
  }
  url.pathname = url.pathname.replace(/\/+$/, "") + "/";
  return url.href;
}

export type YouTrackValue = null | boolean | number | string | YouTrackObject | YouTrackValue[];
export interface YouTrackObject {
  [field: string]: YouTrackValue;
}
export interface ProjectionOptions {
  fields?: string;
}
export interface PageOptions extends ProjectionOptions {
  top?: number;
  skip?: number;
}
export interface IssueSearchOptions extends PageOptions {
  query?: string;
  /** Read every page; fail instead of returning more issues. */
  maxResults?: number;
  /** Fail when this command's decoded response bytes exceed the budget. */
  maxBytes?: number;
}
export interface ByteBudget {
  remaining: number;
}

const issueListFields = "id,idReadable,summary,project(id,name,shortName),updated,resolved";
const commentFields = "id,text,author(id,login),created,updated";

export function requiredText(value: string, label: string): string {
  if (!value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`YouTrack ${label} must be nonempty text without control characters.`);
  }
  return value;
}

export function fields(options: ProjectionOptions, defaults: string): string {
  return requiredText(options.fields ?? defaults, "fields");
}

export function page(options: PageOptions, defaults: string): Record<string, string> {
  const top = options.top ?? 50;
  const skip = options.skip ?? 0;
  if (!Number.isSafeInteger(top) || top < 1) {
    throw new Error("YouTrack top must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(skip) || skip < 0) {
    throw new Error("YouTrack skip must be a nonnegative safe integer.");
  }
  return { fields: fields(options, defaults), $top: String(top), $skip: String(skip) };
}

export function encodedID(id: string, label = "ID"): string {
  requiredText(id, label);
  if (id === "." || id === "..") {
    throw new Error(`YouTrack ${label} must not be a dot path segment.`);
  }
  try {
    return encodeURIComponent(id);
  } catch {
    throw new Error(`YouTrack ${label} must contain valid Unicode text.`);
  }
}

export function issuePath(id: string): string {
  return `api/issues/${encodedID(id, "issue ID")}`;
}

function scrubUrl(text: string, token: string): string {
  try {
    const url = new URL(text, "https://youtrack.example.com");
    const path = decodeURIComponent(url.pathname);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const signedPath = /(?:^|\/)(?:sign|signature|token)=/i.test(path);
    const keys = [...url.searchParams.keys(), ...fragment.keys()];
    const reflectedToken = [
      path, decodeURIComponent(url.hash.slice(1)), ...keys,
      ...url.searchParams.values(), ...fragment.values(),
    ].some((part) => part.includes(token));
    const credentialQuery = keys.some((key) => [
      "sign", "sig", "signature", "token", "accesstoken", "refreshtoken", "idtoken",
      "secret", "password", "credential", "credentials", "auth", "authorization", "authtoken",
      "apikey", "key", "awsaccesskeyid", "xamzsignature", "xamzcredential", "xamzsecuritytoken",
      "xgoogsignature", "xgoogcredential",
    ].includes(key.replace(/[-_]/g, "").toLowerCase()));
    return url.username || url.password || signedPath || credentialQuery || reflectedToken ? "[redacted]" : text;
  } catch {
    return "[redacted]";
  }
}

function scrubText(text: string, token: string): string {
  if (!/\s/.test(text) && /[\/?#]/.test(text) && scrubUrl(text, token) === "[redacted]") {
    return "[redacted]";
  }
  return text.replace(/(?:https?:\/\/|\.\.?\/|\/)[^\s"'<>]+/gi, (url) => scrubUrl(url, token))
    .replaceAll(token, "[redacted]");
}

function scrub(value: YouTrackValue, token: string): YouTrackValue {
  if (typeof value === "string") {
    return scrubText(value, token);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrub(item, token));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      scrubText(key, token), scrub(item, token),
    ]));
  }
  return value;
}
function object(value: YouTrackValue): YouTrackObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("YouTrack returned an invalid object response.");
  }
  return value;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: YouTrackObject | FormData;
  allowEmpty?: boolean;
  budget?: ByteBudget | undefined;
}

async function request(
  connection: Connection,
  path: string,
  query: Record<string, string>,
  responseName = "JSON",
  options: RequestOptions = {},
): Promise<YouTrackValue> {
  const url = new URL(path, youTrackUrl(connection.baseUrl));
  url.search = new URLSearchParams(query).toString();
  const token = connection.token.trim();
  if (!token || /[\r\n]/.test(token)) {
    throw new Error("YouTrack authentication requires a non-empty single-line token.");
  }
  const body = options.body;
  const multipart = body instanceof FormData;
  let response: Response;
  try {
    response = await (connection.fetch ?? globalThis.fetch)(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined || multipart ? {} : { "Content-Type": "application/json" }),
      },
      method: options.method ?? "GET",
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
      redirect: "error",
      ...(connection.signal === undefined ? {} : { signal: connection.signal }),
    });
  } catch {
    throw new Error("YouTrack request failed; check connectivity, TLS and the configured URL.");
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    const retryAfter = response.headers.get("retry-after");
    let retry = "";
    if (response.status === 429 && retryAfter) {
      if (/^\d+$/.test(retryAfter) && Number.isSafeInteger(Number(retryAfter))) {
        retry = ` Retry after ${Number(retryAfter)} seconds.`;
      } else if (/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(retryAfter)) {
        const date = new Date(retryAfter);
        if (!Number.isNaN(date.getTime())) {
          retry = ` Retry after ${date.toUTCString()}.`;
        }
      }
    }
    // The status lets batch callers separate a definite rejection from an uncertain write.
    throw Object.assign(new Error(`YouTrack request failed (HTTP ${response.status}).${retry}`), {
      status: response.status,
    });
  }
  let text: string;
  try {
    const bytes = await readResponseBody(response, {
      signal: connection.signal,
      ...(options.budget === undefined ? {} : { maxBytes: options.budget.remaining }),
    });
    if (options.budget) options.budget.remaining -= bytes.length;
    // Match Response.text(): UTF-8 replacement decoding with an initial BOM removed.
    text = new TextDecoder().decode(bytes);
  } catch {
    throw new Error(options.budget === undefined
      ? "YouTrack response stream failed or was cancelled."
      : "YouTrack response stream failed, exceeded --max-bytes, or was cancelled.");
  }
  let value: YouTrackValue;
  try {
    if (options.allowEmpty && !text.trim()) {
      return null;
    }
    value = JSON.parse(text) as YouTrackValue;
  } catch {
    throw new Error(`YouTrack returned an invalid ${responseName} response.`);
  }
  if (options.allowEmpty && value === null) {
    throw new Error("YouTrack returned an invalid mutation response.");
  }
  return value;
}

export async function readObject(
  connection: Connection,
  path: string,
  query: Record<string, string>,
  body?: YouTrackObject,
): Promise<YouTrackObject> {
  const options: RequestOptions = body === undefined ? {} : { method: "POST", body };
  return object(scrub(await request(connection, path, query, "JSON", options), connection.token.trim()));
}

export async function readNullableObject(
  connection: Connection,
  path: string,
  query: Record<string, string>,
): Promise<YouTrackObject | null> {
  const value = scrub(await request(connection, path, query), connection.token.trim());
  return value === null ? null : object(value);
}

// Only the download implementation may consume this transient, unredacted URL.
export async function getAttachmentDownloadMetadata(
  connection: Connection,
  attachmentPath: string,
): Promise<{ id: string; name: string; mimeType: string | null; url: string }> {
  const value = object(await request(connection, attachmentPath, { fields: "id,name,mimeType,url" }));
  const token = connection.token.trim();
  const { id, name, mimeType, url } = value;
  if (
    typeof id !== "string" || !id.trim() ||
    typeof name !== "string" || !name.trim() ||
    typeof url !== "string" || !url.trim() ||
    (mimeType !== null && typeof mimeType !== "string") ||
    [id, name, mimeType, url].some((item) => typeof item === "string" && item.includes(token))
  ) {
    throw new Error("YouTrack returned invalid attachment download metadata or no download URL.");
  }
  return { id, name, mimeType, url };
}

export async function readCollection(
  connection: Connection,
  path: string,
  query: Record<string, string>,
  budget?: ByteBudget,
): Promise<YouTrackObject[]> {
  const value = scrub(await request(connection, path, query, "JSON", { budget }), connection.token.trim());
  if (!Array.isArray(value)) {
    throw new Error("YouTrack returned an invalid collection response.");
  }
  if (value.length > Number(query.$top)) {
    throw new Error("YouTrack returned more items than the requested top limit.");
  }
  return value.map(object);
}

/**
 * Read an offset collection in server order until a short page proves the selection complete.
 * Repeated string IDs are dropped; offset paging is not a snapshot of a changing dataset.
 */
export async function readPages(
  connection: Connection,
  path: string,
  query: Record<string, string>,
  { top, skip, maxResults = Infinity, budget }: {
    top: number; skip: number; maxResults?: number; budget?: ByteBudget | undefined;
  },
): Promise<YouTrackObject[]> {
  const items: YouTrackObject[] = [];
  const ids = new Set<string>();
  for (let offset = skip; ;) {
    const size = Math.min(top, maxResults + 1 - items.length);
    const page = await readCollection(connection, path, { ...query, $top: String(size), $skip: String(offset) }, budget);
    const before = items.length;
    for (const item of page) {
      if (typeof item.id !== "string" || !ids.has(item.id)) items.push(item);
      if (typeof item.id === "string") ids.add(item.id);
    }
    if (items.length > maxResults) {
      throw new Error("YouTrack selection exceeds --max-results; narrow the query or raise the budget.");
    }
    if (page.length < size) return items;
    if (items.length === before) {
      throw new Error("YouTrack repeated a full page; paging stopped without a complete selection.");
    }
    offset += size;
  }
}

type ResourcePath = string | ((...arguments_: never[]) => string);
type ResourcePathArguments<Path extends ResourcePath> =
  Path extends (...arguments_: infer Arguments extends string[]) => string ? Arguments : [];

function resourceArguments<Options extends object>(values: unknown[]): {
  pathArguments: string[];
  options: Options;
} {
  const items = [...values];
  const tail = items.at(-1);
  const hasOptions = tail === undefined ||
    (tail !== null && typeof tail === "object" && !Array.isArray(tail));
  const options = hasOptions && items.length
    ? (items.pop() ?? {}) as Options
    : {} as Options;
  if (items.some((item) => typeof item !== "string")) {
    throw new Error("YouTrack resource arguments must be text.");
  }
  return { pathArguments: items as string[], options };
}

function resourcePath(
  path: ResourcePath,
  arguments_: string[],
): string {
  return typeof path === "string"
    ? path
    : Reflect.apply(path, undefined, arguments_) as string;
}

/** Define one ordinary bounded YouTrack collection without repeating transport/query plumbing. */
export function readCollectionAt<const Path extends ResourcePath>(
  path: Path,
  defaultFields: string,
): (
  connection: Connection,
  ...arguments_: [...ResourcePathArguments<Path>, options?: PageOptions]
) => Promise<YouTrackObject[]> {
  return async (connection, ...values) => {
    const { pathArguments, options } = resourceArguments<PageOptions>(values);
    return readCollection(
      connection,
      resourcePath(path, pathArguments),
      page(options, defaultFields),
    );
  };
}

/** Define one ordinary projected YouTrack object without repeating transport/query plumbing. */
export function readObjectAt<const Path extends ResourcePath>(
  path: Path,
  defaultFields: string,
): (
  connection: Connection,
  ...arguments_: [...ResourcePathArguments<Path>, options?: ProjectionOptions]
) => Promise<YouTrackObject> {
  return async (connection, ...values) => {
    const { pathArguments, options } = resourceArguments<ProjectionOptions>(values);
    return readObject(connection, resourcePath(path, pathArguments), {
      fields: fields(options, defaultFields),
    });
  };
}

export async function currentUser(connection: Connection): Promise<YouTrackUser> {
  const value = await request(connection, "api/users/me", { fields: "id,login" }, "identity");
  const token = connection.token.trim();
  if (
    value === null || typeof value !== "object" ||
    !("id" in value) || typeof value.id !== "string" || !value.id.trim() ||
    !("login" in value) || typeof value.login !== "string" || !value.login.trim() ||
    scrubText(value.id, token) !== value.id || scrubText(value.login, token) !== value.login
  ) {
    throw new Error("YouTrack returned an invalid identity response.");
  }
  return { id: value.id, login: value.login };
}

export async function readUser(
  connection: Connection,
  options: ProjectionOptions = {},
): Promise<YouTrackUser | YouTrackObject> {
  return options.fields === undefined
    ? currentUser(connection)
    : readObject(connection, "api/users/me", { fields: fields(options, "id,login") });
}

export const listProjects = readCollectionAt("api/admin/projects", "id,name,shortName");

function positiveBudget(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`YouTrack ${label} must be a positive safe integer.`);
  }
  return value;
}

export async function listIssues(
  connection: Connection,
  options: IssueSearchOptions = {},
): Promise<YouTrackObject[]> {
  const query: Record<string, string> = {
    ...page(options, issueListFields),
    ...(options.query === undefined ? {} : { query: requiredText(options.query, "query") }),
  };
  const budget = options.maxBytes === undefined
    ? undefined
    : { remaining: positiveBudget(options.maxBytes, "max-bytes") };
  return options.maxResults === undefined
    ? readCollection(connection, "api/issues", query, budget)
    : readPages(connection, "api/issues", query, {
      top: Number(query.$top),
      skip: Number(query.$skip),
      maxResults: positiveBudget(options.maxResults, "max-results"),
      budget,
    });
}

export const getIssue = readObjectAt(issuePath, `${issueListFields},description,created`);
export const listComments = readCollectionAt(
  (issueID: string) => `${issuePath(issueID)}/comments`,
  commentFields,
);

export function mutationBody(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error("YouTrack body must be a JSON object.");
  }
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error(`This YouTrack slice supports only these body fields: ${allowed.join(", ")}.`);
  }
  return value as Record<string, unknown>;
}

export function narrative(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`YouTrack ${label} must be nonempty text.`);
  }
  return value;
}

export function nullableText(value: unknown, label: string): string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error(`YouTrack ${label} must be text or null.`);
  }
  return value;
}

export async function mutate(
  connection: Connection,
  path: string,
  body: YouTrackObject,
  projection: string,
): Promise<YouTrackObject | null> {
  const value = await request(connection, path, { fields: projection }, "JSON", {
    method: "POST", body, allowEmpty: true,
  });
  return value === null ? null : object(scrub(value, connection.token.trim()));
}

export async function deleteObject(connection: Connection, path: string): Promise<YouTrackObject | null> {
  const value = await request(connection, path, {}, "JSON", { method: "DELETE", allowEmpty: true });
  return value === null ? null : object(scrub(value, connection.token.trim()));
}

export async function uploadObjectCollection(
  connection: Connection,
  path: string,
  body: FormData,
  projection: string,
): Promise<YouTrackObject[] | null> {
  const value = await request(connection, path, { fields: projection }, "JSON", {
    method: "POST", body, allowEmpty: true,
  });
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new Error("YouTrack returned an invalid upload collection response.");
  }
  return value.map((item) => object(scrub(item, connection.token.trim())));
}

export async function addComment(
  connection: Connection,
  issueID: string,
  input: unknown,
): Promise<YouTrackObject | null> {
  const body = mutationBody(input, ["text"]);
  return mutate(connection, `${issuePath(issueID)}/comments`, {
    text: narrative(body.text, "text"),
  }, commentFields);
}
