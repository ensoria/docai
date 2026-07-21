# Semantic Drift Audit

This file records the semantic-drift audit between the `0.12.0`
complete-generator-ready candidate corpus and the intended DocAI HTTP `1.0.0`
stable conformance corpus.

Audit date: 2026-07-21

## Compared Corpora

| Role | Path |
|---|---|
| Evaluated candidate corpus | `fixtures/complete-candidates/v0.12.0/` |
| Stable conformance corpus | `fixtures/conformance/v1.0.0/` |

## Result

Semantic drift exists between the evaluated `0.12.0` candidate and the corrected
`1.0.0` conformance corpus prepared for `v1.0.0-rc.2`.

The existing live LLM, token-load, and OpenAPI comparison records remain valid
historical evidence for the exact `0.12.0` documents they evaluated. They must not
be described as direct evidence for the corrected conformance documents. A later
release step must either refresh affected evidence against a versioned `rc.2`
evaluation snapshot or keep all published comparison claims explicitly scoped to
`0.12.0`.

## Difference Classification

| Change | Classification | Evaluation impact |
|---|---|---|
| Metadata stamp version, generation identity, source path, and source revision | Metadata/provenance | No live rerun by itself; deterministic context metrics change |
| Authoritative input-set manifest and pass-through behavior source | Provenance | No live rerun by itself unless source content is included in a task prompt |
| `enum(...)` Type values corrected to `string` plus enum constraints | Syntax correction with preserved API meaning | Rerun a task when the corrected table is in its prompt |
| XML XPath-like Field values replaced by logical DocAI field paths | Syntax clarification with preserved XML wire meaning | Focused checker evidence changes; current required live tasks do not load the XML focused fixture |
| Request `same_as` positive and negative coverage | Checker/fixture coverage | No current required live task changes unless the new fixture is loaded |
| Explicit `Idempotency-Key`, conflict behavior, and ambiguous-outcome rules | Task-behavior-affecting | Request construction and workflow behavior expectations change; related error handling context also changes |
| Document upload 422 corrected-input retry instruction | Task-behavior-affecting | Upload request/error guidance changes |
| Token-budget wording and section 9.1 responsibility wording | Normative clarification | No task rerun unless the full specification is part of a task prompt |

## File Coverage

Comparable and newly added evidence checked:

- `valid/full/` and `valid/compact/` standard DocAI HTTP document sets.
- `focused/valid/` and `focused/invalid/` snippets.
- `source/complete-openapi.yaml`.
- `source/complete-input-set.yaml` and `source/complete-behavior.yaml`, which do
  not exist in the evaluated `0.12.0` corpus.
- `source/recursive-direct-openapi.yaml`.
- `source/recursive-indirect-openapi.yaml`.

The `0.12.0` evaluation result files are intentionally not modified or duplicated
into the stable compatibility boundary.

## Required-Task Impact

| Task group | Impact | Recommended action before an `rc.2`-specific evidence claim |
|---|---|---|
| Request construction | Create-user and upload-document contexts now define `Idempotency-Key`; expected safe request behavior changes | Rebuild prompts from corrected documents and rerun required targets |
| Response handling | Payment context changed, although the expected response interpretation is unchanged | Rerun if publishing a complete corrected-corpus result set |
| Error handling | User error context adds `idempotency_conflict` and corrected-input/new-key guidance | Rebuild prompts and rerun required targets |
| Workflow completion | Checkout recovery now distinguishes same-key replay from a new logical attempt | Rebuild prompts and rerun required targets |
| Token load | Every standard stamp and several task documents changed size | Recompute all deterministic context metrics |
| OpenAPI comparison | Existing results compare OpenAPI conditions with the `0.12.0` DocAI context | Keep them scoped to `0.12.0`, or rebuild and rerun all conditions before making an `rc.2` comparison claim |

## Refresh Rule

If corrected standard documents change again, update this classification before
reusing or refreshing evaluation evidence. Live provider requests require explicit
user approval and are not part of deterministic release-readiness checks.
