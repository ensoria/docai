# v1.0.0-rc.3 Source Review

This review sheet limits the `rc.3` regression review to the two results left by
focused review of `v1.0.0-rc.2`. Unrelated feature requests are not stable
blockers unless they expose another contradiction in the intended compatibility
boundary.

Review preparation date: 2026-07-21

## Finding 4: Authoritative Source Completeness

Expected result: resolved.

| Review target | Required evidence |
|---|---|
| Success responses | POST cart validation 200, payment 201, order 201, and document 201 each define `x-docai-body-presence: always`, `application/json`, and a concrete response schema. |
| Existing user responses | POST user 201 and GET user 200 retain complete `User` schemas; POST user 201 defines required `Location`. |
| Error bodies | `StandardError`, `ValidationError`, and `EmailTakenError` define all projected fields, requiredness, and closed-object boundaries. |
| Error behavior | `complete-behavior.yaml` defines message usage, field-message usage, common/validation status and caller actions, and endpoint error conditions. |
| Request facts | User email syntax/uniqueness, name length, role default, payment constraints, and document metadata are represented by the authoritative OpenAPI. |
| Webhook facts | Header and payload structure are in OpenAPI; delivery and header wire behavior are in the behavior source. |
| Input identity | The manifest binds `fixture-openapi-rc3-001` and `fixture-behavior-rc3-001` into `fixture-input-set-rc3-001`. |
| Projection identity | Full, compact, and focused metadata use the `rc3-001` source revision and projection IDs. |
| Traceability | `SOURCE-TRACEABILITY.md` contains a fact matrix plus success-response and error-shape inventories. |
| Deterministic gate | The stable checker verifies every required operation/schema block; the isolated negative test removes the cart response reference and must fail. |

The projected DocAI API contract must remain unchanged. Reviewers should compare
the `rc.2` tag with the working `valid/` and `focused/` directories and confirm
that only provenance stamp lines changed.

## Finding 8: Current-Release Wording

Expected result: resolved.

- Root `README.md` identifies `v1.0.0-rc.2` as published and `rc.3` as in
  preparation.
- `docai-http/README.md` identifies `v1.0.0-rc.2` as the current tagged public
  release and retains the release-candidate label.
- `RELEASE.md` records the same current release and reserves `Stable` for final
  published `v1.0.0`.

## Evaluation Impact

No Live LLM provider request is required. Source YAML is not loaded by the task
packet, and projected task semantics did not change. Existing required-target
responses are regraded deterministically, context metrics are recomputed, and
OpenAPI comparison evidence remains historical `0.12.0` evidence.

## Reviewer Result

- [ ] Finding 4 source completeness is resolved.
- [ ] Finding 8 current-release wording is resolved.
- [ ] No new stable-blocking contradiction was found inside this review scope.
- [ ] Any unrelated feature request was classified as post-`1.0.0` backlog.
