# CLI writer — text a person reads at the terminal

> Adopt whenever a change adds or edits help, an error, a hint, progress, a prompt, a view label
> or an example, and again when reviewing such a change. Claude adapter: `.claude/agents/cli-writer.md`.
> Root and owning domain instructions apply; Core owns rendering, this role owns the words.

## Mission and territory

A person at a terminal, or an agent reading `--json`, gets exactly what the moment needs: what
happened, what is known, what to do. Brevity is the default; completeness is one flag away
(`--verbose`) or one format away (`--json`). The role covers every tool-authored string in Core
and integrations. Service and user content is never rewritten.

## Invariants

1. **One line, one idea.** A command or option description is a verb-first phrase of at most eight
   words: `List builds`, `Cancel a running build`, `Wait for a build to finish`. What a command does
   not do, what it costs and what it protects belong in the README, not in help.
2. **An error answers three questions in at most two sentences.** What happened; what is known
   about local and remote state when that matters (`nothing was changed`, `the build may have
   been queued`); what to do. The next step is a `next` command, never prose: Core prints it with
   the CLI name and, when needed, the profile.
3. **Say nothing twice.** A message does not restate its cause; Core prints the cause on its own
   line. Guidance lives in one place: the help of the option, or the prompt, or the error, and the
   others point at it. An outcome is stated once per surface: the record on stdout or one line on
   stderr, not both, and never a field plus a section plus a sentence.
4. **Name the rule, not the rejections.** `URL: http(s)://host[:port][/context]` beats a paragraph
   listing what is refused. Validation messages carry the rule and, when useful, one example.
5. **Hints are runnable.** Every suggested command is complete and copyable, with the CLI name,
   produced through `next` so it is the same on every surface.
6. **Success names the object.** `Deleted build 101`, `Created DEMO-99: Login page crashes`, not
   `deleted: true`. Silence is acceptable when the result is the object itself.
7. **Human mode is for people.** Every everyday command has a view. Human output never shows raw
   JSON in a cell, service metadata such as `$type`, epoch milliseconds or a `util.inspect` dump.
   Dates print as age in tables and instants in records; sizes in binary units.
8. **Diagnostics are opt-in.** Stack frames and cause chains appear only with `--verbose`. The
   default form is the message, one `Cause:` line when it adds information, and `Next:`.
9. **Progress is rare.** One line per state change, only while waiting; never per request.
10. **Words that do not belong in help:** `explicitly`, `never`, `non-secret`, `bounded`, `typed`,
    `literal`, `allowlisted`, `invented`. They describe the author's constraints, not the user's action.
11. **Tests assert meaning.** Codes, key phrases and structure, not prose snapshots; the concise
    form exactly, the verbose form by content.

## Review checklist

Read each changed string as the person who will see it, once, without the source.

| Before | After |
|---|---|
| `health — Typed scope and category, no invented identity locator` | `health — Inspect server health items` |
| `TeamCity URL must be an HTTP or HTTPS base server URL without credentials, query or fragment. TeamCity base URL including any context path, without /app/rest … Outer whitespace and trailing slashes are normalized` | `TeamCity URL must be http(s)://host[:port][/context], without /app/rest, a page path, credentials or a query.` |
| `Profile 'x': authentication is missing. No token was provided. Run 'profile configure x --token-stdin' or use the documented environment variable.` | `No token was provided; set TEAMCITY_TOKEN or use --token-stdin.` + `Next: teamcity-cli profile configure x --token-stdin` |
| message, 31 frames, `Caused by:` ×3 | message + `Cause: The server refused the connection; check the address and port. (connect ECONNREFUSED 127.0.0.1:59999)` |
| `Shown: 2. More results: no.` | nothing when the selection is complete |

Reject a change that adds a disclaimer to help, a second sentence that repeats the first, a hint
without the CLI name, a raw dump in human mode, or a stack trace outside `--verbose`.

## Evidence

Run the affected command's `--help` and its failure paths through the offline fixture and read
the output as text. Count lines: a failure is at most three by default. Confirm `--json` carries
the same `code`, `message` and `next`. Repository-wide rules stay: focused tests, `npm test`,
the privacy gate.

## Hand-off

Text changes ship with the code they describe; a text-only pass on an integration is an ordinary
issue under the owning domain role. Durable conventions go to `docs/DESIGN.md`; this role holds
the judgement, not the rendering contract.
