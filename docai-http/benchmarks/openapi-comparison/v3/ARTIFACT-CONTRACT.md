# Benchmark v3 Calibration Artifact Contract

This contract defines the immutable input and evaluator boundary for
`3.0.0-calibration.1`. The plan may become `calibration-frozen` only together
with a manifest that passes all model, cost, schedule, private-packet, secret,
and SHA-256 checks. The manifest does not authorize Live execution.

## Required Classes

`freeze-manifest.json` contains relative logical paths and a SHA-256 digest for
every collected artifact in these eleven closed classes:

| Class | Frozen contents |
|---|---|
| `authoritative-sources` | Complete-commerce OpenAPI, behavior, and source input set. |
| `docai-contexts` | Every Stable `1.0.0` full and compact DocAI context file available to the calibration tasks. |
| `tasks-and-expected-outcomes` | The six-task v3 continuity packet, including private assertions used by deterministic grading. |
| `contracts-and-prompts` | V3 output contracts, prompt builder and template, private calibration prompt packet, and private-storage policy. |
| `parser-and-graders` | V3 parser, multidimensional record validator, and deterministic grader. |
| `context-builders` | V3 context wrapper, schedule utilities, parity checker, and private prompt metrics. |
| `provider-adapters-and-runner` | All three adapters, transport/error helpers, resumable runner, run checker, and calibration CLI. |
| `calibration-schedule-and-gate` | Plan and method documents, schedule generator and artifact, plan/freeze checkers, reliability gate, strict JSON helper, and blinded adjudication tools. |
| `model-resolutions` | Dated official-catalog resolutions, limits, request settings, source URLs, and provider-specific current rates. |
| `cost-estimate` | Estimator, dated preflight, and machine-readable 24-request token and USD ceilings. |
| `imported-v2-dependencies` | The five unchanged v2 context dependencies explicitly named by the v3 runner revision. |

The manifest cannot hash itself. Its bytes are instead included in the runner
revision computed immediately before Live execution. Every other runner
revision input, including the Task 9 strict JSON helper, must be a manifest
entry.

The frozen plan records `freeze.artifact_set_sha256`, a SHA-256 seal over the
canonical manifest artifact array excluding the plan entry. The manifest then
hashes the final plan bytes, including that seal. This mutual binding rejects a
manifest that re-hashes changed covered content without also changing the
already-frozen plan.

## Imported V2 Boundary

V3 imports only these unchanged v2 dependencies:

- `docai-http/tools/openapi-comparison-v2-context.mjs`
- `docai-http/tools/openapi-comparison-v2-contract.mjs`
- `docai-http/tools/openapi-comparison-v2-utils.mjs`
- `docai-http/benchmarks/openapi-comparison/v2/plan.json`
- `docai-http/benchmarks/openapi-comparison/v2/contracts.json`

Their paths and current SHA-256 values are recorded under
`imported-v2-dependencies`. Freezing v3 never edits a v2 file. Any later change
to one of these dependencies invalidates the v3 manifest and requires a new
calibration revision.

Imported v2 files are hashed byte-for-byte and are exempt from v3 canonical
JSON formatting checks. This preserves the immutable v2 evidence instead of
silently reformatting it. All v3-owned JSON and JSONL artifacts remain subject
to canonical formatting validation.

## Private Artifacts

Generated prompts and context metrics remain below the ignored `private/`
root. The committed manifest records only their generic logical paths and
hashes. It contains no prompt text, expected answer, response, credential,
account identifier, or billing state.

Ordinary frozen checks verify every public artifact and every private artifact
that is locally present. This permits a public checkout without ignored prompt
files. `--private-required` additionally requires both private files and
reproduces metrics and the cost estimate from the canonical prompts. A present
private file is always hash-checked, even in ordinary mode.

## Validation Rules

Freeze creation and validation reject missing public files, path traversal,
symlinks, duplicate paths, unknown classes, noncanonical manifest ordering,
hash changes, and likely credentials. Every artifact is required to be
strictly decodable UTF-8 text so secret scanning fails closed. The scanner
recognizes provider-key assignments, OpenAI/Anthropic-style keys, Google keys,
and concrete bearer credentials while allowing SHA-256 values, exact model
IDs, environment-variable references, and documented placeholders.

The frozen-output check also requires:

1. exact model and provider identities from the 2026-09-03 catalog record;
2. exact provider request settings and current provider-specific rates;
3. the canonical 24-row schedule and prompt matrix;
4. deterministic `ceil(characters / 4)` input estimates with 10% contingency;
5. 8,192 output tokens per request and exactly eight requests per provider;
6. a cost packet whose target totals reproduce independently before summing;
7. all eleven artifact classes and the exact collected path set; and
8. a plan hash that covers the `calibration-frozen` status and freeze metadata.

Changing any covered byte, model, rate, setting, prompt, task assertion,
adapter, evaluator, or imported v2 dependency invalidates the manifest. Such a
change must produce a new retained calibration revision rather than overwrite
this one.

Freeze publication validates the complete generated pair before changing either
destination. It atomically replaces the manifest first and the plan last. Until
the final plan rename, the visible plan remains a draft and no frozen validator
can accept the intermediate pair. A write, rename, or final-validation failure
restores the draft plan before restoring or removing the prior manifest.
