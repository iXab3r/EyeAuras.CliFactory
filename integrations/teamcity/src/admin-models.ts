import type { ScopedSecrets } from "@eyeauras/cli-factory";
import { locatorValue, idPath, requiredText } from "./locator.js";
import { pathSegment } from "./authoring-models.js";
import { distinctIds } from "./bulk-configuration-models.js";
import {
  array,
  inputRecord,
  inputText,
  object,
  safeScalars,
  teamCityTimestamp,
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
  if (kind === "users" && !/^[1-9]\d*$/.test(id))
    throw new Error("User ID must be a positive decimal string.");
  return kind === "users"
    ? "/app/rest/users/" + idPath(id, "User ID")
    : "/app/rest/userGroups/" + groupLocator(id);
}
export const safeAccountUser = (value: unknown) => safeScalars(value, ["id", "username", "name"]);
export const safeGroup = (value: unknown) => safeScalars(value, ["key", "name", "description"]);
export const safeNode = (value: unknown) => safeScalars(value, ["id", "role", "state", "current"]);
export const safeRole = (value: unknown) => safeScalars(value, ["roleId", "scope"]);
export function groupKeys(keys: readonly string[]) {
  return { group: distinctIds(keys).map((key) => ({ key })) };
}
export interface RoleInput {
  roleId: string;
  global?: boolean;
  project?: string;
}
function assignmentScope(input: { global?: unknown; project?: unknown }) {
  if (input.global !== undefined && input.global !== true)
    throw new Error("Global scope must be true.");
  if ((input.global === true) === (input.project !== undefined))
    throw new Error("Choose exactly one global or project scope.");
  return input.global ? "g" : "p:" + inputText(input.project, "Project ID");
}
export function roleBody(value: unknown) {
  const input = inputRecord(value, ["roleId", "global", "project"]);
  return { roleId: inputText(input.roleId, "Role ID"), scope: assignmentScope(input) };
}
export function roleSuffix(input: RoleInput) {
  const role = roleBody(input);
  return { role, suffix: "/" + pathSegment(role.roleId) + "/" + pathSegment(role.scope) };
}
export function roleBodies(inputs: readonly unknown[]) {
  if (inputs.length > 100) throw new Error("At most 100 role assignments are supported.");
  const roles = inputs.map(roleBody);
  distinctIds(roles.map((role) => JSON.stringify([role.roleId, role.scope])));
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
    expirationTime = teamCityTimestamp(input.expires);
    const iso = expirationTime.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})([+-])(\d{2})(\d{2})$/,
      "$1-$2-$3T$4:$5:$6$7$8:$9",
    );
    const expiry = Date.parse(iso);
    if (!Number.isFinite(expiry) || expiry <= Date.now())
      throw new Error("Token expiry must be a valid future timestamp.");
  }
  const restrictions = input.restrictions ?? [];
  if ((input.samePermissions === true) === restrictions.length > 0)
    throw new Error("Choose same-permissions or explicit restrictions.");
  if (restrictions.length > 100) throw new Error("At most 100 restrictions are supported.");
  const permissionRestriction = restrictions.map((value) => {
    const item = inputRecord(value, ["permission", "global", "project"]);
    const scope = assignmentScope(item);
    return {
      permission: { id: inputText(item.permission, "Permission") },
      ...(scope === "g" ? { isGlobalScope: true } : { project: { id: scope.slice(2) } }),
    };
  });
  distinctIds(permissionRestriction.map((item) => JSON.stringify(item)));
  return {
    name,
    ...(expirationTime === undefined ? {} : { expirationTime }),
    ...(permissionRestriction.length ? { permissionRestrictions: { permissionRestriction } } : {}),
  };
}
export function credentialAlias(alias: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(alias))
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
