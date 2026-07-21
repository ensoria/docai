# v1.0.0-rc.4 Metadata Review

This review sheet limits the `rc.4` regression review to the two results left by
review of published `v1.0.0-rc.3`. Unrelated feature requests are not stable
blockers unless they expose another contradiction in the intended compatibility
boundary.

Review preparation date: 2026-07-21

## Focused Source Identity

Expected result: resolved.

- All 53 metadata-bearing focused snippets outside the dedicated negative case
  use projection ID `conformance-20260721-rc4-001`.
- Each such stamp has the profile-specific `rc4-001` generation ID, references
  `fixtures/conformance/v1.0.0/source/complete-input-set.yaml`, and declares
  `source_revision: fixture-input-set-rc3-001`.
- The source revision remains `rc3-001` because the authoritative input content
  did not change between RC.3 and RC.4.
- `focused/invalid/focused-source-revision-missing.md` intentionally omits the
  revision and the stable checker must reject it.
- `tools/check-conformance-boundary.mjs` independently removes a focused source
  revision and must observe checker failure.

## Current-Release Wording

Expected result: resolved.

- Root `README.md`, `docai-http/README.md`, and `RELEASE.md` identify
  `v1.0.0-rc.4` as the current tagged public release.
- They identify focused RC.4 review as the next release gate and reserve
  `Stable` for final published `v1.0.0`.
- The published `v1.0.0-rc.3` tag is not rewritten.

## Contract And Evaluation Impact

The DocAI HTTP format, authoritative input content, and projected client
contract are unchanged. Required tasks do not load focused snippets, and the
standard-document projection ID replacement is equal length. No Live LLM
provider request is required.

## Reviewer Result

- [ ] Focused source identity is complete and checker-enforced.
- [ ] Current-release wording is correct.
- [ ] No new stable-blocking contradiction was found inside this review scope.
- [ ] Any unrelated feature request was classified as post-`1.0.0` backlog.
