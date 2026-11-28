# Task: issue-258-art-criteria

## Target

- Workspace: netverse3d
- Item: GitHub issue #258
- Desired outcome: Fix the H5 source reference, link the approved art criteria from open model and scene issues, and report the remaining personal read acknowledgment accurately.

## Scope

- Repos:
  - netverse3d -> repos/netverse3d.md
- Allowed paths / out of scope: docs/wiki/product/art-criteria.md and this task state; related GitHub issue bodies only for adding the approved criteria link. No model or scene implementation.
- Allowed globs: docs/wiki/product/art-criteria.md, .state/**
- Cross-harness primary: this repository

## Rollup

- Status: in progress
- Summary: H5 source reference corrected locally; seven open related issues now link the criteria page. The Windows pnpm verify run is red in test:scripts; PR pending.

## Progress

- Done: Verified GitHub issue #258, corrected H5 locally, and added/read back the approved page link in open issues #234, #237, #238, #244, #248, #251, and #256.
- Next step: Commit, push, and open a PR with exact gate status.
- Blocked on: None for documentation; the user's personal read acknowledgment must remain unchecked.

## Open questions

- None.

## Handoff note

- Issue #258 was reopened after PR #402 because H5 names a nonexistent HeroPart.bevel and related issue bodies lacked a direct art-criteria.md link. The user explicitly said they have not read all criteria and images; do not check their acknowledgment.
