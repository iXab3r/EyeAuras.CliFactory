---
name: Bug report
about: Report a reproducible defect without exposing private service data
title: "[Bug] "
labels: bug
assignees: ""
---

## Impact

<!-- Who is affected and which behavior is blocked or unsafe? -->

## Observed behavior

<!-- Include safe evidence only. Never paste credentials, private logs, or raw service payloads. -->

## Expected behavior

## Reproduction

<!-- Minimal argv/steps. Redact profile values and all secrets. -->

## Environment

<!-- OS, Node/package version, and integration/profile type without credentials. -->

## Suspected boundary

<!-- Optional: parser, command declaration, profile, permission, HTTP, renderer, or transport. -->

## Acceptance criteria

- [ ] A deterministic regression test reproduces the defect.
- [ ] The expected behavior is restored without weakening adjacent contracts.
- [ ] Focused verification and `npm test` pass.
- [ ] CI and closing implementation evidence are linked.
