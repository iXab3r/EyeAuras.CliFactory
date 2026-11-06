import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import type { IAppArguments } from "./app-arguments.js";
import { CliError, diagnosticCause } from "./errors.js";
import type { SecretStore } from "./types.js";

/** One encrypted file per secret: independent writes cannot lose unrelated keys. */
export class WindowsDpapiSecretStore implements SecretStore {
  public constructor(private readonly appArguments: IAppArguments) {}

  #location(service: string, account: string) {
    const separator = account.indexOf(":");
    if (service !== `ai-cli-factory:${this.appArguments.AppName}` || separator < 1) {
      throw new Error("Secret identity does not belong to this application and profile.");
    }
    const profile = account.slice(0, separator);
    const name = account.slice(separator + 1);
    const directory = join(this.appArguments.WithProfile(profile).AppDataDirectory, "secrets");
    return {
      directory,
      file: join(directory, `${createHash("sha256").update(name).digest("hex")}.dpapi`),
      entropy: Buffer.from(JSON.stringify([service, account]), "utf8"),
    };
  }

  public async get(service: string, account: string): Promise<string | undefined> {
    try {
      const { file, entropy } = this.#location(service, account);
      let encrypted: Buffer;
      try { encrypted = await readFile(file); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
      const { Dpapi } = await import("@primno/dpapi");
      const plaintext = Dpapi.unprotectData(encrypted, entropy, "CurrentUser");
      try { return new TextDecoder("utf-8", { fatal: true }).decode(plaintext); }
      finally { plaintext.fill(0); }
    } catch (error) { throw storageError("read", error); }
  }

  public async set(service: string, account: string, value: string): Promise<void> {
    let temporary: string | undefined;
    try {
      const { directory, file, entropy } = this.#location(service, account);
      const { Dpapi } = await import("@primno/dpapi");
      const plaintext = Buffer.from(value, "utf8");
      let encrypted: Uint8Array;
      try { encrypted = Dpapi.protectData(plaintext, entropy, "CurrentUser"); }
      finally { plaintext.fill(0); }
      // Inherit the user's AppData ACL, including access granted by the active sandbox.
      // Replacing it with a protected user-only DACL blocks AppContainer processes.
      await mkdir(directory, { recursive: true, mode: 0o700 });
      temporary = join(directory, `${randomUUID()}.tmp`);
      await writeFile(temporary, encrypted, { flag: "wx", mode: 0o600 });
      // Windows can briefly hold the destination open during concurrent reads/replaces.
      // Retry only local atomic publication; never delete the old file to make it succeed.
      for (let attempt = 0; ; attempt++) {
        try { await rename(temporary, file); break; }
        catch (error) {
          if (attempt === 5 || !["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
          await setTimeout(10 * 2 ** attempt);
        }
      }
    } catch (error) { throw storageError("write", error, [value]); }
    finally { if (temporary) await rm(temporary, { force: true }).catch(() => {}); }
  }

  public async delete(service: string, account: string): Promise<void> {
    try {
      const { file } = this.#location(service, account);
      await rm(file, { force: true });
    } catch (error) { throw storageError("delete", error); }
  }
}

function storageError(operation: string, error: unknown, secrets: readonly string[] = []): Error {
  return new CliError(`Could not ${operation} the encrypted credential file.`, {
    code: "secrets.unavailable", cause: diagnosticCause(error, secrets),
  });
}
