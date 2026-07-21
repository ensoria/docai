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
| Projection identity | Required for RC.3: full, compact, and focused metadata use the `rc3-001` source revision and projection IDs. Review found this unmet for focused metadata. |
| Traceability | `SOURCE-TRACEABILITY.md` contains a fact matrix plus success-response and error-shape inventories. |
| Deterministic gate | The stable checker verifies every required operation/schema block; the isolated negative test removes the cart response reference and must fail. |

The projected DocAI API contract must remain unchanged. Reviewers should compare
the `rc.2` tag with the working `valid/` and `focused/` directories and confirm
that only provenance stamp lines changed.

## Finding 8: Current-Release Wording

Expected result before tagging: resolved. Post-publication review found the
wording stale and routed the correction to RC.4.

- Before the RC.3 tag, root `README.md` and `docai-http/README.md` identified
  `v1.0.0-rc.2` as published and `rc.3` as in preparation.
- After publication they needed to identify `v1.0.0-rc.3` as the current tagged
  public release while retaining the release-candidate label.
- `RELEASE.md` must reserve `Stable` for final published `v1.0.0`.

## Evaluation Impact

No Live LLM provider request is required. Source YAML is not loaded by the task
packet, and projected task semantics did not change. Existing required-target
responses are regraded deterministically, context metrics are recomputed, and
OpenAPI comparison evidence remains historical `0.12.0` evidence.

## Reviewer Result

Review completed after publication of `v1.0.0-rc.3`. The authoritative source
content listed under Finding 4 was confirmed complete, and no unrelated stable
blocker was found. The review did not approve promotion to stable because most
metadata-bearing focused snippets omitted the available `source_revision`, and
the documentation still described `rc.3` as being prepared after its tag was
published. These results are corrected and re-reviewed through `rc.4`.

- [x] Finding 4 authoritative source content is complete.
- [ ] Finding 4 projection identity is complete in tagged `rc.3`.
- [ ] Finding 8 current-release wording is correct in tagged `rc.3`.
- [x] No unrelated stable-blocking contradiction was found inside this review scope.
- [x] Any unrelated feature request was classified as post-`1.0.0` backlog.
