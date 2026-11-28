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

- Status: partial
- Summary: H5 correction is in draft PR #467; seven open related issues link the criteria page. Windows pnpm verify remains red in test:scripts; the user's read acknowledgment is pending.

## Progress

- Done: Verified GitHub issue #258, corrected H5 in draft PR #467, added/read back the approved page link in open issues #234, #237, #238, #244, #248, #251, and #256, and asked @baodhg for another assignment in issue comment 7239885770.
- Next step: Review PR #467 and decide how to resolve the Windows test failure before merge.
- Blocked on: The user has not read all criteria and images, so their personal acknowledgment must remain unchecked.

## Open questions

- None.

## Handoff note

- Issue #258 was reopened after PR #402 because H5 names a nonexistent HeroPart.bevel and related issue bodies lacked a direct art-criteria.md link. Draft PR #467 addresses H5. The user explicitly said they have not read all criteria and images; do not check their acknowledgment. The full Windows verify remains red due test environment behavior, recorded in PR #467.
