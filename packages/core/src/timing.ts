import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID, createHash } from 'node:crypto';
import { openSync, writeSync, constants } from 'node:fs';
import { isAbsolute, join } from 'node:path';

interface Span { request: string; id: number; scope?: string | undefined }
const spans = new AsyncLocalStorage<Span>();
let sequence = 0, records = 0, descriptor: number | undefined, disabled = false;
const directory = process.env.CLI_FACTORY_TRACE_DIRECTORY;
/** Opt-in, process-local monotonic trace. Never pass arguments, URLs or response text as names. */
export function timingEnabled(): boolean { return Boolean(directory && isAbsolute(directory) && !disabled); }
function emit(stage: string, state: Span, parent: number | undefined, start: bigint, ok: boolean) {
  if (!timingEnabled() || ++records > 200000) return;
  try {
    descriptor ??= openSync(join(directory!, `${process.pid}-${randomUUID()}.jsonl`), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    writeSync(descriptor, JSON.stringify({ schema: 1, pid: process.pid, request: state.request, id: state.id, parent,
      ...(state.scope ? {scope: state.scope} : {}), stage, startNs: start.toString(), durationNs: (process.hrtime.bigint() - start).toString(), ok }) + '\n');
  } catch { disabled = true; } // Instrumentation must not change the command outcome.
}
export async function timingSpan<T>(stage: string, work: () => T | Promise<T>): Promise<T> {
  if (!timingEnabled()) return work();
  if (!/^[a-z][a-z0-9._-]{0,79}$/.test(stage)) throw new Error('Timing stage must be a static diagnostic name.');
  const parent = spans.getStore(), state = {request: parent?.request ?? randomUUID(), id: ++sequence, scope: parent?.scope};
  const start = process.hrtime.bigint(); let ok = false;
  return spans.run(state, async () => { try { const value = await work(); ok = true; return value; }
    finally { emit(stage, state, parent?.id || undefined, start, ok); } });
}
/** A logical command owns a fresh request; contexts/caller IDs are irreversibly hashed together. */
export function timingRequest<T>(work: () => T | Promise<T>): Promise<T> {
  if (!timingEnabled()) return Promise.resolve().then(work);
  return spans.run({ request: randomUUID(), id: 0 }, () => timingSpan('command.total', work));
}
export function timingScope<T>(identity: string, work: () => T | Promise<T>): Promise<T> {
  if (!timingEnabled()) return Promise.resolve().then(work);
  const parent = spans.getStore();
  return spans.run({request: parent?.request ?? randomUUID(), id: parent?.id ?? 0,
    scope: createHash('sha256').update(identity).digest('hex').slice(0, 24)}, () => Promise.resolve().then(work));
}
export function timingSync<T>(stage: string, work: () => T): T {
  if (!timingEnabled()) return work();
  if (!/^[a-z][a-z0-9._-]{0,79}$/.test(stage)) throw new Error('Timing stage must be a static diagnostic name.');
  const parent = spans.getStore(), state: Span = {request: parent?.request ?? randomUUID(), id: ++sequence, scope: parent?.scope};
  const start = process.hrtime.bigint(); let ok = false;
  return spans.run(state, () => {try {const value = work(); ok = true; return value;} finally {emit(stage,state,parent?.id || undefined,start,ok);}});
}
