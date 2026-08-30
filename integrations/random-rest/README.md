# random-rest-cli

A deliberately small example using RANDOM.ORG's **older, keyless HTTP interface**. No account,
API key, token or browser is required. The obsolete API is an explicit demonstration choice, not
a fallback from the newer JSON-RPC service. This version runs in-process: IPC hosting and the
Playwright companion are not implemented yet.

## Run

From the repository root:

```text
npm ci
npm run build
npm exec -- random-rest-cli --help
npm exec -- random-rest-cli profile configure default --contact <your-email>
npm exec -- random-rest-cli integers --count 5 --min 1 --max 6 --json
npm exec -- random-rest-cli sequence --min 1 --max 10 --json
```

Replace `<your-email>` with an operator-controlled contact address. RANDOM.ORG asks automated
clients to include an email in User-Agent; this is contact information, **not authentication**.
It is stored in the normal profile JSON, sent only as part of User-Agent, and can be shown by
profile-inspection commands. Do not use credentials as the contact value. There are no auth commands.

The default service URL is the explicitly selected public `https://www.random.org`. Profiles can
set `--url <https-origin>`; URLs with credentials, paths, queries or fragments are rejected.
Profile/config/permission data stays in normal current-user AppData under application identity
`random-rest-cli`, never the working directory. Machine mode never prompts for missing contact;
it returns an actionable `profile configure` error before network access.

For scripts requiring completely clean stdout, invoke the built executable directly:

```text
node integrations/random-rest/dist/src/bin.js integers --count 3 --min 1 --max 6 --json
```

## Two commands

| Command | Defaults | Meaning |
|---|---|---|
| `integers --count <n> --min <n> --max <n>` | count=1, min=1, max=100 | Independent draws; duplicates allowed |
| `sequence --min <n> --max <n>` | min=1, max=10 | Every integer in the inclusive range exactly once, shuffled |

Both return `{ "values": [3, 1, 2] }` (illustrative data). Both are `ReadOnly`: they obtain new
random data but do not modify user-owned remote records; generation **does consume the IP's bit
quota**. Each request returns at most 100 integers, with bounds within +/-1,000,000,000. Inputs
must be integral, min < max, and a sequence's inclusive range must fit the 100-value limit.
Equal bounds are rejected before networking: both legacy endpoints return HTTP 503 for them.
Strings and other generators are intentionally deferred.

Factory-generated human output, `--json`, `--profile`, permissions and `--json-rpc` all use the
same two command declarations. `RandomClient` in `src/models.ts` is the small service contract;
`createRandomCommands` is independent of HTTP and can later be reused by the Playwright client.
No RANDOM.ORG concepts were added to Core.

## Service behavior and limits

- GET requests use plain text, decimal output and fresh randomization. Values are validated for
  count/range and, for sequences, uniqueness. Errors never include raw service bodies.
- Each generation checks quota first. Negative quota stops the command and asks the caller to
  wait at least ten minutes; the same client instance suppresses polling during that period.
- Each HTTP request has a two-minute timeout. There are no automatic retries, redirect following,
  cached random values, or fallback random generators. A rerun is a new draw, not a replay.
- One client's quota/generation operations are sequential. **Separate CLI processes or different
  profile clients are not coordinated in this pre-IPC example.** Run them sequentially against the
  live service, and do not restart the CLI to bypass quota backoff. Quota is shared by public IP,
  not isolated by CLI profile. Parallel/stress tests must use mocked boundaries, not RANDOM.ORG.
- Browser authentication persistence is not demonstrated by these anonymous operations.

Official references: [HTTP API](https://www.random.org/clients/http/) and
[automated-client guidelines](https://www.random.org/clients/).

## Verify

```text
npm run build --workspace @eyeauras/cli-factory
npm run build --workspace @eyeauras/random-rest-cli
npm run test:compiled --workspace @eyeauras/random-rest-cli
npm test
```

The default tests are offline: MSW intercepts native fetch, test AppData is isolated, and the
actual packaged bin is exercised with a test-only bootstrap. Fixtures use only synthetic values.

For explicit local live evidence, configure a real named profile first, then run:

```text
npm run test:integration --workspace @eyeauras/random-rest-cli -- --profile <configured-profile>
```

This runs four separately reported `node:test` integration cases against the live service, through
the actual packaged CLI and your normal profile:

- five integers within a signed range;
- three integers from 0..1 (repeated values must be accepted);
- a shuffled five-item signed interval (complete, unique and in range);
- a minimal two-item sequence (0..1).

Assertions cover successful process exit, clean JSON stdout, empty success stderr, integer values,
count, bounds and sequence uniqueness. Tests never require independent random samples to differ.
The complete run requests only 15 values, with a quota check before each generation. Tests run
sequentially and skip remaining requests after the first failure, including quota/network errors.

The runner rejects CI, missing profiles and extra URL/credential/command overrides. Output contains
test names/statuses and sanitized failure categories, never response arrays, profile contact or raw
subprocess output. It neither writes fixtures nor persists proof artifacts. The offline suite also
executes this exact runner and its CLI subprocesses under MSW to verify orchestration and safety;
those rehearsal results are not live-service evidence.
