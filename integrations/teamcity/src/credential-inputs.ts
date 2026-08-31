import type { ScopedSecrets } from "@eyeauras/cli-factory";
import { credentialAlias } from "./admin-models.js";
export async function preflightSecretKeys(secrets: ScopedSecrets, keys: readonly string[]) {
  if (!keys.length || keys.length > 50 || new Set(keys).size !== keys.length)
    throw new Error("Supply1–50 distinct destination keys.");
  for (const key of keys) {
    let existing;
    try {
      existing = await secrets.get(key);
    } catch {
      throw new Error("Cannot inspect secure destination; no remote operation attempted.");
    }
    if (existing !== undefined) throw new Error("Destination alias already exists.");
  }
}
export async function persistSecretKeys(
  secrets: ScopedSecrets,
  keys: readonly string[],
  values: readonly string[],
) {
  if (values.length !== keys.length || values.some((v) => typeof v !== "string" || !v.length))
    throw new Error("Invalid sensitive response; remote outcome is unknown.");
  try {
    for (let i = 0; i < keys.length; i++) await secrets.set(keys[i]!, values[i]!);
  } catch {
    throw new Error(
      "Remote operation succeeded but secure persistence failed; some keys may be stored. Do not retry automatically.",
    );
  }
}

export const inputSecretKey = (alias: string) => "input-secret:" + credentialAlias(alias);
export async function requireInputSecret(secrets: ScopedSecrets, alias: string) {
  const key = inputSecretKey(alias);
  try {
    return await secrets.require(key);
  } catch {
    throw new Error("Required profile input-secret is unavailable; no remote write was attempted.");
  }
}
export async function importInputSecret(secrets: ScopedSecrets, alias: string, env: string) {
  const key = inputSecretKey(alias);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(env)) throw new Error("Invalid environment variable name.");
  const value = process.env[env];
  if (!value) throw new Error("Named input environment variable is missing or empty.");
  let exists: string | undefined;
  try {
    exists = await secrets.get(key);
  } catch {
    throw new Error("Could not inspect input-secret storage.");
  }
  if (exists !== undefined)
    throw new Error("Input-secret alias already exists; forget it explicitly first.");
  try {
    await secrets.set(key, value);
  } catch {
    throw new Error(
      "Could not persist input-secret in the OS credential store; no plaintext fallback.",
    );
  }
  return { alias, stored: true };
}
export async function forgetInputSecret(secrets: ScopedSecrets, alias: string) {
  const key = inputSecretKey(alias);
  try {
    await secrets.delete(key);
  } catch {
    throw new Error("Could not remove the input-secret secure entry.");
  }
  return { alias, forgotten: true };
}
