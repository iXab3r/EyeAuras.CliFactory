# AI CLI Factory — agent router

AI CLI Factory builds small, homogeneous TypeScript CLIs for humans and AI agents. This file is
the entry point for coding agents. Keep it compact; durable design belongs in `docs/`.

**Canonical spec:** [`docs/DESIGN.md`](docs/DESIGN.md). Read it before changing architecture or a
public API. If code and design disagree, stop and reconcile them explicitly.

## Route by surface

| Editing | Read next | Responsibility |
|---|---|---|
| `packages/core/**` | [`packages/core/AGENTS.md`](packages/core/AGENTS.md) | Service-agnostic CLI mechanisms |
| `integrations/**` | [`integrations/AGENTS.md`](integrations/AGENTS.md) + [`docs/integrations.md`](docs/integrations.md) | Thin, service-shaped products |
| tests or fixtures | [`docs/testing.md`](docs/testing.md) | Mock-first evidence and sanitization |
| GitHub Issues or issue templates | [`docs/practices/github-issues.md`](docs/practices/github-issues.md) | Feature scope, bug evidence, and closure contract |
| `scripts/**`, `.github/**`, docs | This file + relevant design section | Repository tooling and public contract |

More specific `AGENTS.md` files override this router only inside their directory.

## Universal laws

1. **Do not overengineer.** Implement the smallest vertical slice demanded by a current consumer.
   No generator, plugin system, DI container, universal HTTP layer, or compatibility shim without
   concrete evidence.
2. **One command declaration.** Help, human output, JSON output, and JSON-RPC execution derive from
   the same recursive command tree. Handlers return data; they do not render formats.
3. **Secrets never become config.** Use the injected secret store. Never print, log, snapshot, or
   commit credentials. There is no plaintext fallback.
4. **Profiles isolate environments.** Endpoint/config and credential identity both include the
   active profile. Tests must cover any change that could cross profiles.
5. **AppData belongs to the current user and profile.** Derive profile-owned files from
   `AppArguments.AppDataDirectory`. Never add portable, executable-relative, or working-directory
   storage. Secrets remain in the OS credential store.
6. **Permission-gated means explicit.** When an integration enables permission gates, every
   service leaf declares a category. Read operations use `ReadOnly`; side effects use `Update` or
   a documented custom category. Never weaken a category merely to make a command pass.
7. **Mock the network boundary.** Default tests are offline and deterministic. Real-service tests
   are explicit, opt-in, read-only by default, and sanitized before becoming fixtures.
8. **Keep service concepts in integrations.** Core must not know TeamCity terminology. Extract a
   shared mechanism only when another real integration proves it.
9. **Verify in proportion to risk.** Run the narrow affected tests during work and `npm test`
   before declaring a repository-wide change complete.
10. **Commit hygiene.** Never rewrite pushed history or force-push. Inspect staged changes for
   secrets and generated noise before committing.

## Function role: Reconciliation Lead

Use **Reconciliation Lead** when work has multiple useful phases, a declared inventory, or needs
to be resumable by another agent. Read [`docs/roles/reconciliation-lead.md`](docs/roles/reconciliation-lead.md)
and [`docs/practices/workstreams.md`](docs/practices/workstreams.md). When a GitHub Issue owns the
feature scope, also read [`docs/practices/github-issues.md`](docs/practices/github-issues.md). The
role owns plans and ledgers under `.workspace/workstreams/`; it composes with, but never replaces,
the domain role that owns production code.

## Repository shape

```text
packages/core/           shared factory primitives
integrations/teamcity/   first executable integration
docs/                    canonical design and practices
scripts/                 .NET 10 bootstrap and repository tools
.workspace/workstreams/  tracked plans, ledgers, and handovers for phased work
```

Submodules are initialized through `dotnet run --file scripts/bootstrap.cs`. Add a submodule only
with a working, independently versioned consumer—not as an empty architectural placeholder.
