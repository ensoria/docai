# Benchmark v2 Artifact Contract

This contract lists the evidence that must exist before the plan can change
from `pre-registration-draft` to `frozen`. It does not freeze artifact contents
by itself.

## Public Before Execution

The following may be committed before Live LLM execution because they do not
contain holdout source facts or expected answers:

- `README.md`, `PLAN.md`, and `plan.json`;
- the schedule generator and plan checker;
- provider-neutral runner and checkpoint schemas;
- the generic prompt envelope and strict output schemas, provided they contain
  no task answers;
- reusable OpenAPI slicing and deterministic context-measurement code; and
- generic grader code whose comparison values come only from private expected
  outcomes.

## Private Until All Nine Batches Close

Store these below `private/`, which is ignored except for its README:

- both holdout OpenAPI documents and authoritative behavior inputs;
- holdout DocAI HTTP full and compact projections;
- holdout user tasks, expected outcomes, and grader evidence;
- exported prompts and contexts that expose holdout facts;
- batch checkpoints and provider responses; and
- intermediate grader and manual-adjudication records.

The existing `complete-commerce` continuity fixture may remain public. Its new
task packet and generated prompts should still be included in the freeze hash
set so all four conditions share one plan identity.

## Required Freeze Classes

`freeze-manifest.json` must contain at least one SHA-256 entry for every class
listed in `plan.json`:

| Class | Minimum contents |
|---|---|
| `authoritative-sources` | Three OpenAPI inputs and all behavior inputs used by enriched OpenAPI and DocAI HTTP. |
| `docai-contexts` | Full and compact Stable `1.0.0` document sets for all APIs. |
| `tasks-and-expected-outcomes` | Exactly six Live LLM task contracts per API, including expected outcomes and fixture-gap annotations. |
| `prompt-templates-and-output-schemas` | One condition-neutral task envelope and every strict JSON output schema. |
| `graders` | Generic grader implementation plus task-specific grading configuration. |
| `context-builders` | Raw, reference-closed slice, enriched, and DocAI selected-profile builders. |
| `model-resolutions` | Official catalog check date, requested model ID, and resolved alias or snapshot for all three targets. |
| `cost-estimate` | Estimated input/output ceiling and current provider-specific price calculation for the whole pilot and each batch. |

The generated `schedule.jsonl` is also hashed. A freeze manifest records only
relative logical paths and hashes for private artifacts; it must not reveal API
keys, account IDs, billing balances, or other secrets.

## Freeze Review

Before freezing, review and verify:

1. A source-parity report proves that `openapi-enriched` and `docai-selected`
   receive the same authoritative task facts.
2. Prompt export contains no expected outcome or grader-only evidence.
3. Every task passes its grader against a hand-authored positive result and
   fails at least one targeted negative result.
4. Context metrics reproduce from the hashed inputs.
5. The generated primary schedule has 648 unique run IDs in nine 72-request
   batches.
6. The concrete `b01` estimate is presented to and approved by the user.

Only then may `plan.json` move to a `2.0.0-frozen.N` version and the frozen-plan
checker be expected to pass.
