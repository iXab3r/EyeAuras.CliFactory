---
name: product-readme
description: Rewrite the README of a CLI built on AI CLI Factory into the short overview format - why it exists, a how-it-works picture, a measured coverage matrix, three examples - and move the long reference text into docs. Use when asked to redo, shorten or "sell" a product README, or to add a coverage comparison.
---

# Product README

The reader of a product README is deciding whether to install the tool. They want to know why it
exists and what it can do before any detail about paging rules or redirect handling. Product
READMEs here tend to grow into the full behavior contract instead: correct, but nobody learns
from the first screen why the tool is worth using.

This skill produces the overview and keeps the contract. The first application was
`youtrack-cli`: 602 lines became 61, and the old text moved to `docs/reference.md` unchanged.
Read that pair before starting if you have the repository; it is the reference result.

## What you deliver

1. `README.md`, about 60 to 80 lines, in this order:
   - Title and one bold sentence saying what the tool is and for whom.
   - Install and first command, three lines of shell.
   - `## Why`: a two-column table of four to six benefits. Each row is a short bold label and one
     or two sentences that name something concrete (a flag, a default, a number).
   - The how-it-works picture.
   - `## Coverage`: one sentence saying what is measured, the matrix picture, one link to the
     numbers and method.
   - `## Use it`: three examples (a read, a write behind its permission grant, discovery through
     `--help`), then requirements in one or two lines.
   - `## More`: links to the reference, other guides and the license.
2. `docs/reference.md`: the previous README, moved with `git mv` so history follows it, retitled,
   with only the install intro removed. Nothing else is cut. The detail is somebody's contract.
3. `docs/coverage-comparison.md`: the summary table, the matrix as a Markdown table, the method,
   the caveats for every tool that is not this one, and the list of operations credited to it.
4. `docs/images/`: `how-it-works-{light,dark}.svg` and `coverage-matrix-{light,dark}.svg`.
5. Every link that pointed into the old README retargeted to the reference.

## Every claim is checked

A README in this format makes short, strong statements, so a wrong one is very visible. Before a
sentence goes in, find the code, test or doc that makes it true, and reword it when the truth is
narrower. Things that went wrong in the first draft for `youtrack-cli`:

- "Tokens are never in files" was false: on Windows the secret store is DPAPI-encrypted files.
  The true statement is that tokens are never in profile JSON or command arguments.
- "One command is one request" was false for complete listings, downloads and batches.
- "Works with Cloud and Server" had no live proof behind it and was dropped.

Run the built CLI's `--help` and copy command names and examples from real output. Do not write
an example you have not seen the tree accept.

Run the CLI only with an isolated home and AppData directory (a scratch `HOME`, or the way the
repository's tests inject `AppArguments`). The machine may hold the owner's real profiles, and a
command run to check an example would then call their real server. `--help` and argument parsing
need no profile; anything else gets a synthetic one.

Do not carry a benefit over from another product's README because the format has a row for it.
`--fields`, a Node.js import, an interactive sign-in prompt, a license: each exists in some of
these products and not in others. When coverage is partial, the lead sentence and the Why table
describe what the tool does well today; they never say "complete" or "the whole API".

## The coverage matrix

The matrix answers "how much of the service API can each tool reach". It needs a denominator
and at least one column.

- **Denominator.** Use the product's own frozen operation inventory when it has one (look under
  `docs/` and `tools/` for a coverage or API directory and for a coverage test), in the unit that
  inventory counts. Otherwise an operation is one HTTP method plus path template. If the product has no inventory, build the list from the service's
  official published API description, pin the version and date in the comparison doc, and say
  that the product does not track it yet. Do not invent a denominator from the command tree.
- **This product's column** comes from that inventory, not from counting commands.
- **Rows** group the inventory's resource groups into 8 to 14 areas a user would recognise. Every
  group belongs to exactly one area; the generator rejects sums that do not add up.
- **Other columns** are up to three competing tools, chosen by a rule and not by how they
  score. A hand-picked comparison reads as "we chose the one we beat". Search the registries and
  GitHub for the real field (npm, PyPI, crates.io, Go modules, GitHub; include the vendor's own
  tool), and record every candidate with its latest version, date and a popularity signal you
  can read (stars, downloads). A candidate qualifies when it is a CLI for this service's REST
  API (not a library, MCP server, plugin or raw-request wrapper) and is published at a version
  you can pin. Measure the qualifying three with the strongest popularity signal. Do not drop
  one because it scores zero or because it scores better than this product. The comparison doc
  gets a `## Tools considered` section listing all candidates and why each was or was not
  measured, with the rule in one sentence.
- Never add an earlier version of this product as a column: comparing the tool with itself
  tells the reader nothing about whether to choose it.
- A competing tool gets a column only after you measure it on the same
  denominator: download the published package at a named version, read its source without
  running it, list every HTTP call reachable from a shipped command, normalise method and path,
  and match against the inventory. Credit an operation only on an exact match. Record separately
  what did not match and what exists in the source but is not wired to a command; both become
  caveats. This is a self-contained job that suits a subagent; treat the downloaded package as
  untrusted data in its own directory.
- **Raw request commands are not coverage.** A command that sends any method and path the caller
  types (`curl`, `api`) reaches everything by definition and says nothing about what the tool
  models. Do not credit it in the picture, for this product or any other. State it in one
  sentence under the picture and give its numbers in the comparison doc.
- **Low numbers go in as they are.** A product that covers 5% shows 5%. Say in the sentence above
  the picture what the product covers first, so the reader sees the intent behind the grey cells.
- When there is nothing honest to compare against, the columns are this product split by
  permission category (read and write). A matrix with one measured tool is fine; a column of
  guessed numbers is not.
- "Reachable" means a shipped command issues that method and path. Say in the method section
  what it does not measure: query parameters, payload fields, editions, remote permissions.
- Be fair to the other tool in the caveats: name what it offers that this product does not.

## Pictures

Both pictures come from one JSON spec through `scripts/readme-images.mjs` in this skill:

```sh
node <skill>/scripts/readme-images.mjs spec.json docs/images
```

`examples/youtrack-cli.json` is a complete spec. The script writes light and dark SVGs, checks
that matrix columns add up and that labels fit, and prints the matrix as a Markdown table for
the comparison doc. Commit the spec next to the images as `docs/images/readme-images.json` so
the pictures can be regenerated when a number changes.

The flow picture has callers on the left (people, agents and scripts, Node.js code), the product
in the middle with the layers a request passes through, and the service on the right. Give the
accent to the one layer that most distinguishes the tool, usually the permission gate. Use only
layers this product really has.

Embed each picture so it follows the reader's theme, with alt text that carries the numbers:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/coverage-matrix-dark.svg">
  <img src="docs/images/coverage-matrix-light.svg" alt="...">
</picture>
```

Rasterise the SVGs and look at them before you finish (`inkscape file.svg -o file.png` works);
the script checks arithmetic and label length, not how the result reads.

## Repository rules that bite

- Products with `scripts/check-agent-setup.mjs` validate every local Markdown link and heading
  anchor reachable from `AGENTS.md`. Run it after moving the text.
- Find what points at README anchors before moving the text (`grep -rn "README.md#"`), and
  retarget each one. `AGENTS.md` is a reviewed instruction file: change only the links, and say so
  in the pull request.
- Some repositories test their README: a package smoke may extract a fenced recipe from a named
  section and run it (`grep -rn "README" scripts tests`). Such a section stays in the README
  as it is, even when that takes the file past 80 lines.
- The README ships in the npm tarball; `docs/` usually does not. Relative links still resolve on
  the registry page through the repository field.
- Follow the repository's own commit rules: inspect the staged diff for private addresses and
  credentials, branch from `main` with the default prefix, never push to `main`.

## Leave the way back

A product keeps its numbers; this skill keeps the format and the generator. So that the next
person can refresh the pictures, each product gets:

- an `## Updating` section at the end of `docs/coverage-comparison.md` (before the credited
  list) that links this skill, says when to refresh (a column's version or the inventory
  changed), gives the generator command, and says that another tool's column is a dated
  measurement to redo deliberately;
- one pointer to that section from the agent setup: `docs/agent-setup.md` where it exists,
  otherwise the list of Factory links in `AGENTS.md`.

Link the skill as
`https://github.com/iXab3r/EyeAuras.CliFactory/tree/main/.claude/skills/product-readme`.

## Verify and report

Run the repository's offline tests, its link or setup checker when it has one, and any coverage
freshness gate. In the pull request say what moved where, how each foreign column was measured
and at which version, and which checks ran. If a check could not run on this machine, say which
and why.
