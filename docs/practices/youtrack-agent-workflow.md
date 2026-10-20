# YouTrack agent workflow

Use **our `@eyeauras/youtrack-cli` package, executable `youtrack-cli`, as the primary
YouTrack tool**. The Python executable `yt.exe` is a separate product and an explicit
fallback only. A role or adapter named `yt-issue-dev` does not select an executable.
This guide chooses the tool; the consumer repository still owns tracker selection,
project, workflow, authorization, branch/review/merge rules and issue resolution.
CliFactory itself continues to use GitHub Issues as its primary tracker.

## Resolve the primary tool

```text
youtrack-cli --version
youtrack-cli --help
youtrack-cli issues list --help
youtrack-cli issues fields set --help
```

The published package installs with `npm install --global @eyeauras/youtrack-cli`
(Node 22+). In a configured CliFactory checkout, the same source-host entry point is
`npm run youtrack -- <arguments>` after its normal build. Use that existing host or
install the primary package when within task authority before concluding it is
unavailable. No harness-specific skill or PowerShell wrapper is required. Discover
the resolved executable and version; do not treat `yt`, a similarly named skill or
a wrapper as proof that our package is running.

Use an existing named profile explicitly with `--profile <name>`; check `profile
list` and `auth status` without printing credentials. Our profiles and the Python
tool's configuration are independent. Preserve endpoints, context paths, selected
profiles and credential ownership. Never copy tokens into rules, command arguments,
notes or another tool's plaintext config. Auth/configuration, when authorized, uses
the primary CLI's normal masked prompt, secret-store or trusted stdin flow; see
[the integration contract](../../integrations/youtrack/README.md#sign-in-locally).
An empty profile list in one terminal is not evidence that another tool/profile has
the same settings or that YouTrack is down.

## Select the answer before reading payloads

Examples use synthetic `DEMO` identifiers. Substitute the existing issue/project and
profile, keeping each read bounded to its question:

```text
youtrack-cli issues list --query "project: DEMO" --fields "id,idReadable,summary" --top 10 --skip 0 --profile <name> --json
youtrack-cli issues get DEMO-1 --fields "id,idReadable,summary,description" --profile <name> --json
youtrack-cli issues comments list DEMO-1 --fields "id,text,author(login),created" --top 5 --skip 0 --profile <name> --json
youtrack-cli issues fields list DEMO-1 --fields 'id,name,$type,value(id,name,login,isResolved)' --top 20 --skip 0 --profile <name> --json
youtrack-cli project field list DEMO --top 20 --skip 0 --profile <name> --json
```

In PowerShell put a projection containing `$type` in **single quotes** so it remains
literal. Lists use `--top`/`--skip`; `--json` is our machine-output flag. Avoid full
descriptions, comments, attachments and nested objects in a status/inventory query.
Fetch a selected issue or comment when its full text is needed. Retain full fields
for diagnosis through an explicit projection; do not hide required evidence with
shell line cuts or serialize a whole document before filtering it.

A single list is one page. Increase skip using the actual returned count. A full
census explicitly uses `issues list --all --max-results <n>` and may add an aggregate
`--max-bytes <n>`; exceeding either fails without a partial successful result. Offset
paging is not a server snapshot: concurrent issue updates can change the selection.
Request a full census only when the task requires it.

## Use supported writes and verify them

Discover live issue/project field types, value IDs and state-machine events before
writing. `issues update` takes a JSON `--body`; `issues fields set <issueID>
<fieldID>` takes its typed `$type`/value or event body; comments use `issues comments
add <issueID> --body <json>`. Old `yt issues assign`, `--state`, `issues show`,
`issues search` and `--format json` recipes are not our command contract. Consult
the selected leaf's `--help` and the
[write contract](../../integrations/youtrack/README.md#controlled-mutations).

Read UTF-8 payload files into a variable for `--body` rather than interpolating a
multiline JSON string into shell code. Preserve literal `$type`. Validate a batch
before applying it when using the existing `issues batch` workflow. Honor the
primary CLI's profile-specific Update gate and the task's write authorization;
do not switch clients to bypass either. Re-read the issue after every mutation,
especially after an ambiguous network result, before retrying. No automatic write
replay. A CLI failure alone never authorizes moving the issue to another tracker.

## Explicit Python fallback

Use `yt.exe` only when our CLI/source host is unavailable or the needed capability
is confirmed unsupported. Record which implementation is selected and why. An
authentication error, permission denial, validation rejection or uncertain write
result is not a fallback trigger: diagnose/correct it and re-read the existing state.
Fallback retains the same issue owner and task authority; it does not migrate
profiles, copy credentials or grant permission to repeat a write.

Discover this installation's help independently. A verified bounded read for the
Python CLI is:

```text
yt.exe issues list --help
yt.exe issues list --query "DEMO-1" --fields "id,idReadable,summary" --page-size 10 --max-results 10 --format json
```

These Python flags are not interchangeable with our `--top`/`--skip`/`--json`.
Keep fallback writes explicit and verify their actual syntax and read-back state;
do not translate a primary write mechanically or retry an ambiguous one.
