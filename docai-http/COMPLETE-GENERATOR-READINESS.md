# Complete Generator Readiness Plan

This document tracks the evidence required before DocAI HTTP can be advertised as a `Complete-generator-ready candidate`.

It is planning guidance for maintainers, not a separate normative source. `README.md` remains authoritative for the format rules and conformance requirements. If this plan and `README.md` disagree, fix this plan to match `README.md`.

Current status: not complete-generator-ready. The current public label remains `Compatibility Core implementation target`.

Current candidate evidence:

- A full/compact complete example pair exists at `fixtures/complete-candidates/v0.11.0/valid/`.
- That pair includes resources, a workflow, and a webhook with matching standard docs-root-relative paths.
- Focused complete-surface fixtures have started; current coverage is tracked in `fixtures/complete-candidates/v0.11.0/COVERAGE.md`.
- A corpus-specific complete-candidate checker exists at `tools/check-complete-candidates.mjs`.
- A complete-candidate evaluation task packet and local context metrics exist under `fixtures/complete-candidates/v0.11.0/evaluations/`.
- Live LLM execution procedure and gate rationale are documented in `LIVE-LLM-EVALUATION.md`.
- Complete §9.1 focused fixture coverage and required-target LLM task evaluation evidence exist for the current complete-candidate task packet.
- OpenAPI comparison evidence is planned in `OPENAPI-COMPARISON-EVIDENCE.md`; prompt contracts and context metrics exist, but the OpenAPI live task baseline has not been run yet.

## Publication Gate

Do not update the README publication label to `Complete-generator-ready candidate` until all of the following are complete:

- A versioned complete-surface fixture corpus exists.
- The corpus includes at least one valid full-profile document set and one matching compact projection.
- The full and compact sets include `INDEX.md`, `CONVENTIONS.md`, at least one resource file, at least one workflow file, and at least one webhook file.
- Focused valid and invalid fixtures cover every canonical marker, table shape, table-cell normalization rule, and representation boundary named by README section 9.1.
- Checker coverage exists for every non-core feature promoted into the complete surface.
- LLM task evaluations have been run against the valid corpus for request construction, response handling, error handling, workflow completion, and token load.
- `README.md`, `fixtures/README.md`, `RELEASE.md`, and `CHANGELOG.md` describe the same publication label, scope, evidence, and known limits.

Until those conditions are met, complete-surface fixtures and checkers are candidate evidence only. They must not imply stable compatibility for non-core structures.

OpenAPI comparison evidence is not required for the `Complete-generator-ready candidate` label unless the README makes measured comparative claims against OpenAPI. When comparative claims are made, they must be backed by `OPENAPI-COMPARISON-EVIDENCE.md` and should stay scoped to the evaluated fixtures, models, tasks, and run dates.

## Minimum Complete-Surface Corpus

Use this layout for the first complete-surface candidate corpus:

```text
fixtures/complete-candidates/v<version>/
  README.md
  COVERAGE.md
  TOKEN-SAVINGS.md
  source/
    complete-openapi.yaml
    recursive-direct-openapi.yaml
    recursive-indirect-openapi.yaml
  valid/
    full/
      INDEX.md
      CONVENTIONS.md
      resources/
      workflows/
      webhooks/
    compact/
      INDEX.md
      CONVENTIONS.md
      resources/
      workflows/
      webhooks/
  focused/
    valid/
    invalid/
```

The first complete full-profile set must demonstrate:

- Core endpoint structure already covered by the Compatibility Core.
- Selective conventions and endpoint-specific convention deviations.
- Common error shapes, inline error shapes, common-error reuse, and common-error suppression.
- Non-JSON request and response representations promoted into the complete surface.
- Tagged or untagged polymorphic variants promoted into the complete surface.
- Workflow discovery, values passed between steps, failure branches, state transitions, and workflow-section replacement `unsupported`.
- Webhook discovery, triggering endpoint references, event-specific headers, payload variants, delivery deviations, and deduplication guidance.
- Response-header replacement `unsupported`.
- Recursive-schema `unsupported` for direct and indirect recursive source inputs.
- `unknown` and localized or replacement `unsupported` in every allowed complete-surface position.

The matching compact set must demonstrate:

- Identical standard docs-root-relative file paths with the full set.
- Shared `projection_id` with the full set.
- `field_defaults` reductions that can be reconstructed.
- `same_as` only for valid same-kind backward references with discoverable retrieval units.
- Retention of every client-visible request, response, error, and webhook behavior.
- Both non-empty and omitted `Opaque fields` cases.
- Token-saving annotations or measurements for every compact reduction class used in the corpus.

## Required Evidence Matrix

| Area | Required evidence before promotion |
| --- | --- |
| Metadata stamps | Full, compact, workflow, webhook, and focused fixtures for key order, escaping, optional `source_revision`, profile pairing, generation identity, and extension placement. |
| INDEX.md | Endpoint, workflow, and webhook discovery, task labels, `Also read`, optional `Conventions`, deprecation summaries, empty-section `none`, and profile links. |
| CONVENTIONS.md | Fixed heading order, HTTP semantics, common request rules, common response rules, common errors, validation errors, headers, deviations, and whole-section `unknown` / `unsupported`. |
| Endpoint files | Fixed section order, bounded endpoint units, request parts, body markers, responses, errors, behavior, related links, deprecation, deviations, and generated examples. |
| Tables | Canonical table headers, escaped cells, normalized empty cells, table-level unknown markers, invalid unknown positions, and invalid extra structural columns. |
| Parameters | Path matching, structured query/header/cookie fields, repeated values, encoded examples, object and array serialization, and omitted/empty/null-like value distinctions. |
| JSON bodies | Root `$` forms, field paths, exact `null`, `any`, object openness, array item objects, generated-example-to-field-table matching, and non-updatable or patch semantics. |
| Non-JSON bodies | Promoted multipart, form-urlencoded, raw binary, CSV, XML, SSE, or other media-specific markers, samples, encoding rules, boundaries, size/integrity metadata, and invalid omissions. |
| Responses | Status ordering, status ranges, `default`, overlap precedence, body presence, body nullability, response headers, repeatable-header syntax, and response-header replacement `unsupported`. |
| Errors | Common references, inline labels including `unknown` code tokens, endpoint-specific deviations, suppression, retryability, caller action, field-level errors, and error-time state recovery. |
| Workflows | Required headings, INDEX and endpoint references, step values, failure branches, recovery, state transitions, deviations, and section replacement `unsupported`. |
| Webhooks | Required headings, INDEX discovery, triggering endpoints, event-specific headers, grouped variant boundaries, payload presence, deduplication, delivery deviations, and receiver requirements. |
| Compact profile | Full/compact path pairing, shared `projection_id`, `field_defaults`, `same_as`, retrieval-unit discoverability, client-visible field preservation, opaque roots, and token-saving evidence. |
| Polymorphism | Tagged variants, untagged variants, overlapping alternatives, combined variants, discriminator enum coverage, complete per-variant examples, and invalid common tables. |
| Unknown facts | Allowed marker, table-cell, prose, and whole-section positions; required `knowledge: requires-input`; invalid structural unknowns. |
| Unsupported features | Localized and replacement forms, smallest affected unit, source location, required `coverage: requires-source`, and invalid silent omission or approximation. |
| Recursive schemas | Direct and indirect recursive source fixtures whose generated projections use required `unsupported` forms. |
| Token routing | Optional `x-` metadata only when used, placement validity, and no compatibility claim when absent. |

## Checker Plan

The complete-surface checker should start as a corpus-specific expectation checker, not as a public reusable validator.

Required checker behavior before promotion:

- Run all existing candidate checks that are promoted into the complete surface.
- Check the full and compact sets as one paired corpus.
- Reject missing full/compact path pairs, mismatched profile identity, and mismatched coverage or knowledge states.
- Reject promoted non-core structures that lack their required markers, examples, or focused negative fixtures.
- Report fixture name, expected result, actual result, rule area, and detail for every failure.
- Keep source-to-projection checks limited to evidence that is represented in the fixture source files; do not imply full generator validation unless that validator exists.

## LLM Evaluation Plan

Run the valid complete corpus through five task groups before changing the publication label:

- Request construction: build correct path, query, header, cookie, and body values from resource files and conventions.
- Response handling: interpret status selection, response headers, response body presence, nullability, variants, and non-JSON forms.
- Error handling: identify common and inline errors, retryability, caller action, field-level errors, and error-time recovery state.
- Workflow completion: follow workflow steps, pass values between endpoints, preserve state on failure branches, and reconcile webhook delivery.
- Token load: compare full and compact task context, record loaded files and token counts, and verify that compact reductions do not remove behavior needed by the task.

Evaluation results do not need to prove that every LLM succeeds, but they must show that the corpus supports the intended retrieval path and that failures are not caused by missing or contradictory documentation.

## Work Breakdown

1. Create the complete-surface fixture skeleton and source fixture. Done for the first candidate pair in `fixtures/complete-candidates/v0.11.0/`.
2. Merge promoted candidate examples into one full-profile document set. Done for the first candidate pair, without promoting the candidate-only structures.
3. Create the matching compact projection and token-saving notes. Done for the first candidate pair.
4. Add focused valid and invalid fixtures for every README section 9.1 complete-surface requirement.
5. Add the complete-surface expectation checker by composing existing candidate checks where practical.
6. Run the checker and LLM task evaluations. Done for the current complete-candidate task packet; required-target live task records and token-load records are summarized in `fixtures/complete-candidates/v0.11.0/evaluations/RESULTS.md`.
7. Update the README publication label only when all evidence supports the broader claim.
