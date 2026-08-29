---
name: Feature or design
about: Specify a bounded, implementation-ready product change
title: "[Feature] "
labels: enhancement
assignees: ""
---

## Outcome

<!-- Describe the completed user or agent behavior, not the implementation activity. -->

## Baseline

<!-- What already exists and must be reused or preserved? -->

## In scope

<!-- State a bounded feature. For integrations, include the exact contract below. -->

### CLI / API / permission contract

| CLI command | HTTP method and endpoint | Locator, fields, or body | Permission | Returned domain value |
|---|---|---|---|---|

## Behavior contracts

<!-- Profiles/auth, pagination/limits, errors, JSON/JSON-RPC, and side-effect semantics. -->

## Out of scope

<!-- Name adjacent work that must not silently enter this change. -->

## Implementation shape

<!-- Expected code/test/docs surfaces and the smallest useful vertical-slice order. -->

## Test matrix

<!-- Mocked success/empty/error/pagination, CLI JSON, permission denial before fetch, profile isolation. -->

## Acceptance criteria

- [ ] The observable outcome is complete.
- [ ] Focused deterministic tests and `npm test` pass.
- [ ] Public documentation matches shipped behavior.
- [ ] CI and implementation evidence are linked before closure.

## References

<!-- Official API documentation, workstream, dependencies, and follow-ups. -->
