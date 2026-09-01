from pathlib import Path
import hashlib, json

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
baseline = json.loads((HERE / "baseline.json").read_text(encoding="utf-8"))
workspace_names = sorted(baseline["workspaces"])

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

workspaces = {
    name: {
        "package": baseline["workspaces"][name]["package"],
        "source": 0, "tests_support": 0, "proof": 0,
        "other_typescript": 0, "typescript_files": 0,
        "all_included_files": 0,
    }
    for name in workspace_names
}
files = []
excluded = []
for owner in workspace_names:
    for file in sorted((ROOT / owner).rglob("*")):
        if not file.is_file():
            continue
        path = file.relative_to(ROOT).as_posix()
        relative = path[len(owner) + 1:]
        parts = Path(relative).parts
        if any(part in {"generated", "dist", "node_modules", "coverage", ".workspace"} for part in parts):
            excluded.append({"path": path, "reason": "generated/output/dependency/workstream surface"})
            continue
        data = file.read_bytes()
        is_ts = file.suffix in {".ts", ".tsx", ".mts", ".cts"}
        category = (
            "source" if relative.startswith("src/") else
            "proof" if relative.startswith("integration-tests/") else
            "tests_support" if relative.startswith(("tests/", "test/")) else
            "other_typescript"
        )
        row = {
            "path": path, "workspace": owner, "sha256_raw": sha(data),
            "bytes": len(data), "category": category if is_ts else "non_typescript",
            "nonblank_lines": None,
        }
        if is_ts:
            normalized = data.decode("utf-8-sig").replace("\r\n", "\n")
            row.update(
                sha256_lf=sha(normalized.encode()),
                nonblank_lines=sum(bool(line.strip()) for line in normalized.splitlines()),
                lf_utf8_bytes=len(normalized.encode()),
                lf_utf16_characters=len(normalized.encode("utf-16-le")) // 2,
            )
            workspaces[owner][category] += row["nonblank_lines"]
            workspaces[owner]["typescript_files"] += 1
        workspaces[owner]["all_included_files"] += 1
        files.append(row)

specs = [
    ("tc-list", "integrations/teamcity/src/cli.ts", "List projects", "command"),
    ("tc-detail", "integrations/teamcity/src/cli.ts", "Show one project", "command"),
    ("tc-mutation", "integrations/teamcity/src/cli.ts", "Queue a new build for a job", "command"),
    ("yt-list", "integrations/youtrack/src/cli.ts", "Search one page of issues", "command"),
    ("yt-detail", "integrations/youtrack/src/cli.ts", "Show an issue by database", "command"),
    ("yt-mutation", "integrations/youtrack/src/cli.ts", "Update summary and/or description", "command"),
    ("tc-fixture", "integrations/teamcity/tests/support.ts", "export async function createTestRuntime", "excerpt"),
    ("yt-fixture", "integrations/youtrack/tests/cli-fixture.ts", "export async function fixture", "excerpt"),
    ("tc-proof", "integrations/teamcity/integration-tests/profile-proof.ts", None, "excerpt"),
    ("yt-proof", "integrations/youtrack/integration-tests/profile-proof.ts", None, "excerpt"),
    ("tc-download", "integrations/teamcity/src/downloads.ts", "export async function saveDownload", "excerpt"),
    ("yt-download", "integrations/youtrack/src/attachment-download.ts", "export async function downloadIssueAttachment", "excerpt"),
    ("tc-wrapper", "integrations/teamcity/src/command-support.ts", "export type ClientLeaf", "excerpt"),
    ("yt-parsers", "integrations/youtrack/src/cli-support.ts", "export function parseBody", "excerpt"),
    ("existing-random-proof", "integrations/random-common/src/proof.ts", "export function runProof", "excerpt"),
]
samples = []
for label, path, anchor, kind in specs:
    lines = (ROOT / path).read_text(encoding="utf-8-sig").replace("\r\n", "\n").splitlines()
    matches = [i for i, line in enumerate(lines) if anchor in line] if anchor else [0]
    if not matches:
        samples.append({
            "id": label, "path": path, "status": "baseline anchor absent from final file",
            "anchor": anchor,
        })
        continue
    at = matches[0]
    start, end = at, min(len(lines), at + 12)
    if kind == "command":
        start = next(i for i in range(at, -1, -1) if lines[i].strip() == "command(")
        indent = len(lines[start]) - len(lines[start].lstrip())
        end = next(i + 1 for i in range(at + 1, len(lines)) if lines[i] == " " * indent + "),")
    selected = "\n".join(lines[start:end]) + "\n"
    samples.append({
        "id": label, "path": path, "start_line": start + 1, "end_line": end,
        "span_kind": "complete declaration" if kind == "command" else "context excerpt; full file counted above",
        "span_sha256_lf": sha(selected.encode()),
        "nonblank_lines": sum(bool(x.strip()) for x in lines[start:end]),
        "excerpt": lines[start:min(end, start + 8)],
    })

keys = ["source", "tests_support", "proof", "other_typescript", "typescript_files", "all_included_files"]
totals = {key: sum(workspace[key] for workspace in workspaces.values()) for key in keys}
deltas = {
    name: {key: workspaces[name][key] - baseline["workspaces"][name][key] for key in keys}
    for name in workspace_names
}
total_delta = {key: totals[key] - baseline["totals"][key] for key in keys}
result = {
    "schema": "integration-authoring-core-final-candidate-v1",
    "baseline_revision": baseline["revision"],
    "method": "Current filesystem candidate using the baseline's fixed eight workspace roots, exclusions, path categories and nonblank handwritten TypeScript metric. Raw and LF-normalized hashes are recorded; setup files stay outside TS LOC. This is not a commit/tree/CI receipt.",
    "workspaces": workspaces, "totals": totals,
    "delta_from_baseline": {"workspaces": deltas, "totals": total_delta},
    "files": files, "excluded": excluded, "samples": samples,
}
output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
if "--stdout" in __import__("sys").argv:
    print(output, end="")
else:
    (HERE / "final-measurement.json").write_text(output, encoding="utf-8", newline="\n")
    print(json.dumps({"totals": totals, "delta": total_delta, "workspaces": workspaces}))
