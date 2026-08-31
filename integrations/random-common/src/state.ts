import type {
  CliResource,
  CommandContext,
  IAppArguments,
} from "@eyeauras/cli-factory";

/** RANDOM.ORG's quota/backoff belongs to a service session, not an invocation's client. */
export class RandomRequestState {
  #pending: Promise<void> = Promise.resolve();
  #blockedUntil = 0;
  run<T>(action: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const operation = this.#pending.then(() => {
      if (signal?.aborted) throw new Error("RANDOM.ORG request cancelled.");
      if (Date.now() < this.#blockedUntil) throw this.#quotaError();
      return action();
    });
    this.#pending = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }
  exhausted(): Error {
    this.#blockedUntil = Date.now() + 600000;
    return this.#quotaError();
  }
  #quotaError(): Error {
    return new Error(
      "RANDOM.ORG quota is exhausted. Wait at least 10 minutes before trying again.",
    );
  }
}

/** Profile changes reset quota state; ordinary invocations only construct cheap clients. */
export class RandomProfiles implements CliResource {
  #profiles = new Map<
    string,
    { identity: string; state: RandomRequestState }
  >();
  for(context: CommandContext): RandomRequestState {
    const key = context.appArguments.AppDataDirectory;
    const identity = JSON.stringify([
      context.profile.values.url,
      context.profile.values.contact,
    ]);
    let entry = this.#profiles.get(key);
    if (!entry || entry.identity !== identity) {
      entry = { identity, state: new RandomRequestState() };
      this.#profiles.set(key, entry);
    }
    return entry.state;
  }
  invalidateProfile(app: IAppArguments): void {
    this.#profiles.delete(app.AppDataDirectory);
  }
  dispose(): void {
    this.#profiles.clear();
  }
}
