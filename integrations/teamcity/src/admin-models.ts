import type { ScopedSecrets } from "@eyeauras/cli-factory";
import { locatorValue, idPath, requiredText } from "./locator.js";
import { pathSegment } from "./authoring-models.js";
import { textIds } from "./bulk-configuration-models.js";
import {
  array,
  inputRecord,
  apiInputRecord,
  inputText,
  object,
  safeScalars,
} from "./triage-models.js";

export const adminCategories = [
  {
    name: "Admin",
    description: "Change remote accounts, access policy and server administration",
    enabledByDefault: false,
  },
  {
    name: "Credentials",
    description: "Issue/revoke remote credentials or remove explicitly owned local credentials",
    enabledByDefault: false,
  },
];
export type AccountKind = "users" | "groups";
export const accountUserFields = "id,username,name";
export const groupFields = "key,name,description";
export const nodeFields = "id,role,state,current";
export const responsibilityFields = "count,responsibility(name,description)";
export const tokenFields = "name,creationTime,expirationTime";
export const groupLocator = (key: string) => "key:" + locatorValue(key, "Group key");
export function accountPath(kind: AccountKind, id: string) {
  return kind === "users"
    ? "/app/rest/users/" + idPath(id, "User ID")
    : "/app/rest/userGroups/" + groupLocator(id);
}
export const safeAccountUser = (value: unknown) => safeScalars(value, ["id", "username", "name"]);
export const safeGroup = (value: unknown) => safeScalars(value, ["key", "name", "description"]);
export const safeNode = (value: unknown) => safeScalars(value, ["id", "role", "state", "current"]);
export const safeRole = (value: unknown) => safeScalars(value, ["roleId", "scope"]);
export function groupKeys(keys: readonly string[]) {
  return { group: textIds(keys).map((key) => ({ key })) };
}
export interface RoleInput {
  roleId: string;
  global?: boolean;
  project?: string;
}
function assignmentScope(input: { global?: unknown; project?: unknown }) {
  if (input.global !== undefined && typeof input.global !== "boolean")
    throw new Error("Global scope must be a boolean.");
  if ((input.global === true) === (input.project !== undefined))
    throw new Error("Choose exactly one global or project scope.");
  return input.global ? "g" : "p:" + inputText(input.project, "Project ID");
}
export function roleBody(value: unknown) {
  const input = apiInputRecord(value, ["roleId", "global", "project", "scope"]);
  const { global, project, ...native } = input;
  return { ...native, roleId: inputText(input.roleId, "Role ID"),
    scope: input.scope === undefined ? assignmentScope(input) : inputText(input.scope, "Scope") };
}
export function roleSuffix(input: RoleInput) {
  const role = roleBody(input);
  return { role, suffix: "/" + pathSegment(role.roleId) + "/" + pathSegment(role.scope) };
}
export function roleBodies(inputs: readonly unknown[]) {
  const roles = inputs.map(roleBody);
  textIds(roles.map((role) => JSON.stringify([role.roleId, role.scope])));
  return { role: roles };
}
export function safeToken(value: unknown) {
  const raw = object(value);
  return {
    ...safeScalars(raw, ["name", "creationTime"]),
    ...(raw.expirationTime === undefined
      ? {}
      : raw.expirationTime === null
        ? { expirationTime: null }
        : safeScalars(raw, ["expirationTime"])),
  };
}
export interface TokenCreationOptions {
  name: string;
  alias: string;
  expires?: string;
  noExpiration?: boolean;
  samePermissions?: boolean;
  restrictions?: readonly unknown[];
}
export function tokenBody(input: TokenCreationOptions) {
  const name = inputText(input.name, "Name");
  if ((input.expires !== undefined) === (input.noExpiration === true))
    throw new Error("Choose expiry or explicit no-expiration.");
  let expirationTime: string | undefined;
  if (input.expires !== undefined) {
    expirationTime = inputText(input.expires, "Expiration time");
  }
  const restrictions = input.restrictions ?? [];
  if ((input.samePermissions === true) === restrictions.length > 0)
    throw new Error("Choose same-permissions or explicit restrictions.");
  const permissionRestriction = restrictions.map((value) => {
    const item = apiInputRecord(value, ["permission", "global", "project", "isGlobalScope"]);
    const { global, project, ...native } = item;
    const permission = typeof item.permission === "string"
      ? { id: inputText(item.permission, "Permission") } : apiInputRecord(item.permission, []);
    if (item.isGlobalScope === true || (project !== null && typeof project === "object")) {
      if (item.isGlobalScope !== undefined && typeof item.isGlobalScope !== "boolean")
        throw new Error("Global scope must be a boolean.");
      return { ...native, permission, ...(project === undefined ? {} : { project: apiInputRecord(project, []) }) };
    }
    const scope = assignmentScope(item);
    return {
      ...native,
      permission,
      ...(scope === "g" ? { isGlobalScope: true } : { project: { id: scope.slice(2) } }),
    };
  });
  textIds(permissionRestriction.map((item) => JSON.stringify(item)));
  return {
    name,
    ...(expirationTime === undefined ? {} : { expirationTime }),
    ...(permissionRestriction.length ? { permissionRestrictions: { permissionRestriction } } : {}),
  };
}
export function credentialAlias(alias: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(alias))
    throw new Error("Invalid issued-token alias.");
  return alias;
}
export const issuedTokenKey = (alias: string) => "issued-token:" + credentialAlias(alias);
export async function readIssuedToken(secrets: ScopedSecrets, alias: string) {
  const key = issuedTokenKey(alias);
  try {
    return await secrets.get(key);
  } catch {
    throw new Error("Could not inspect the issued-token credential store; no HTTP was attempted.");
  }
}
export function issuedTokenName(contents: string): string {
  try {
    const item = object(JSON.parse(contents));
    if (typeof item.name !== "string" || typeof item.value !== "string" || !item.value)
      throw new Error();
    return requiredText(item.name, "Token name");
  } catch {
    throw new Error("Invalid issued-token secure record; contents omitted.");
  }
}
export async function forgetIssuedToken(secrets: ScopedSecrets, alias: string) {
  const contents = await readIssuedToken(secrets, alias);
  if (contents === undefined) throw new Error("Issued-token alias does not exist.");
  issuedTokenName(contents);
  try {
    await secrets.delete(issuedTokenKey(alias));
  } catch {
    throw new Error("Could not remove the issued-token secure record; contents omitted.");
  }
  return { alias, forgotten: true };
}
export function responsibilities(value: unknown) {
  return array(object(value).responsibility).map((item) =>
    safeScalars(item, ["name", "description"]),
  );
}
