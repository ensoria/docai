# OpenAPI Comparison v3 Calibration Runbook

## Current Status

`3.0.0-calibration.3` is frozen with the reviewed stopped-resume,
verified-report, and execute-CLI corrections. Current model/cost inputs and
77 artifacts were frozen on 2026-11-10. The freeze and final whole-package
reviews passed with no remaining Critical or Important finding. The final
full v3 suite passed 873 tests. The maintainer approved Live execution on
2026-11-10. All 24 calls received responses, but the verified reliability
gate failed: 16 automatic decisions, eight exceptional runs, including four
incomplete responses. See [Live results and follow-up](OPENAPI-COMPARISON-V3-CALIBRATION3-RESULTS.md).

A passing general readiness check is not authorization for Live execution.
The calibration.3 approval has been consumed by its completed run. The commands
below are retained as the historical operator handoff, not instructions to
send more requests. Keep the Live-used identity unchanged. A successor needs
separate review, freeze and explicit Live approval.

The maintainer selected a structured semantic answer contract for the
successor. The [calibration.4 design](OPENAPI-COMPARISON-V3-CALIBRATION4-DESIGN.md)
was approved on 2026-11-10. The
[implementation plan](OPENAPI-COMPARISON-V3-CALIBRATION4-PLAN.md) and task-by-task
independent review were approved on 2026-11-10. Offline draft implementation
is in progress. Tasks1-4 are independently reviewed and complete. Task4 has
74/74 covering tests for the maintainer-approved single-request domain;
unexpected Anthropic iterations remain unknown/unpriced and must stop
subsequent sends. Task5's retained-evidence and terminal-stop enforcement is
implemented and independently reviewed. Phase6A candidate
model/cost/prompt preparation is independently reviewed, not spending approval.
Phase7A offline freeze construction/closure/transaction regressions use only
disposable synthetic fixtures. Production remains a prepared draft: target IDs
null, trust anchor null, no manifest or retained runs. Strong exact-manifest
authority is implemented and tested (affected285/285; fresh authority10/10 on
2026-11-19), but its scoped independent review was interrupted by an automated
review-tool restriction before a verdict. That gate remains required.
Phase7A scoped review,
phase6B whole-package checks/review and actual7B anchoring/publication remain
separate gates. Outer readiness registration waits for actual7B. No Live call
is authorized; fixture dates are not an actual freeze timestamp.

See [preparation checklist](OPENAPI-COMPARISON-V3-CALIBRATION3-PREPARATION.md)
for completed work and remaining gates.

## Calibration 3 Envelope

- Plan identity: `docai-http-openapi-comparison-v3` / `3.0.0-calibration.3`.
- Planned requests: 24, eight for each provider.
- Exact models: `gpt-5.6-sol`, `claude-sonnet-5`, `gemini-3.8-flash`.
- Tasks: `upload-document-request` and `complete-checkout-workflow`.
- Conditions: raw, sliced and enriched OpenAPI, plus selected DocAI context.
- One repetition per task/model/condition.
- Catalog check date: 2026-11-10.
- Combined estimated input: 114,678 tokens; input allocation with contingency:
  126,162 tokens; requested output total at the per-call maximum: 196,608.
- Combined reported-usage token stop threshold: 322,770.
- Combined USD cost stop threshold: 2.4957045, using the frozen standard rates.
- Reliability gate: at least 23 automatic decisions and at most one
  exceptional run, with all 24 canonical identities present.

Per-provider allocation and estimated USD envelope:

| Provider | Model | Requests | Token allocation | Estimated USD |
|---|---|---:|---:|---:|
| OpenAI | `gpt-5.6-sol` | 8 | 107,590 | 1.478936 |
| Anthropic | `claude-sonnet-5` | 8 | 107,590 | 0.739468 |
| Google | `gemini-3.8-flash` | 8 | 107,590 | 0.2773005 |

Provider rows are estimate allocations, not separately enforced caps. The
runtime monitors the combined reported token and USD thresholds.

The frozen [cost packet](benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/cost-estimate.json)
and [model resolutions](benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/model-resolutions.json)
are the authoritative preparation values. Input counts are estimates based on
characters with a contingency. Output is limited to 8,192 requested tokens
per call. Reported-usage stop thresholds are not a provider-side billing cap;
tax, retries, unreported usage and later price changes are not included.
OpenAI's retained promotion runs through 2026-11-30 and Google's through
2026-12-31. Recheck rates before execution after those dates.

Only a pre-response transport failure may retry once. Thus 24 logical
requests can require up to 48 send attempts; the work-step configuration
additionally enforces a 100-attempt ceiling. Fatal stops remain terminal on
re-entry. A failed calibration requires a reviewed follow-up, not an override
that silently resumes the stopped run.

This is non-primary reliability evidence. The 24-request calibration remains
the planned exception to the normal 50-to-100 request work step. No primary
schedule or public accuracy claim follows until calibration review passes.

## Public Preflight And Dry Run

Run from the repository root. These public checks omit `--private-required`
and need no retained provider responses, runs, checkpoints or adjudication.

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-plan.mjs --frozen
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/freeze.mjs --check
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-parity.mjs
node docai-http/tools/check-release-readiness.mjs
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/run-calibration.mjs --dry-run
```

The public plan and freeze checks validate the three exact models and the
frozen token/cost packet. Confirm separately that the dry run reports the
plan identity, 24-request ceiling, 100-attempt ceiling, key presence without
values, and zero provider calls. Local integrity does not prove current
provider availability or account access.

## Approval-Gated Live Execution

Only after the final review and the maintainer's explicit confirmation for
this exact identity, model panel and budget:

```sh
DOCAI_LIVE_LLM_APPROVED_CALIBRATION=3.0.0-calibration.3 \
  node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/run-calibration.mjs --execute
```

The runner validates private frozen inputs and exact approval before transport.
Stop and report any integrity, provider, budget or attempt-limit failure.
Do not clear stopped checkpoints, remove retained records or change model IDs.

## Verified Results And Gate

After the approved run stops or completes:

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-runs.mjs
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-gate.mjs
```

`check-runs` re-derives retained results before producing its report. Read
`usage.complete` and `usage.unknown_attempts` alongside numeric usage; unknown
usage does not mean a request was free. The gate consumes only verified
evidence. Semantic task pass rate is diagnostic in this reliability calibration.

## Conditional Adjudication

Only verified automatic `inconclusive` records enter manual review. After
the run check succeeds, create a blinded packet from the same verified
evidence in one process:

```sh
node --input-type=module <<'NODE'
import path from "node:path";
const base = new URL("./docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/", import.meta.url);
const load = (name) => import(new URL(`${name}.mjs`, base));
const { readPlan, PRIVATE_DIR } = await load("paths");
const { readTaskPacket } = await load("contract");
const { buildCalibrationPrompts } = await load("prompt");
const { verifyCalibrationEvidence } = await load("evidence-verifier");
const { FileRunStore, buildRunnerRevision } = await load("runner");
const { buildBlindedAdjudicationPacket, writeBlindedAdjudicationPacket } = await load("adjudication");
const plan = readPlan();
const taskPacket = readTaskPacket(plan);
const tasks = taskPacket.tasks.filter((task) => plan.calibration.task_ids.includes(task.id));
const prompts = buildCalibrationPrompts({ plan, packet: taskPacket });
const store = new FileRunStore({
  runsDir: path.join(PRIVATE_DIR, "runs", plan.plan_version),
  checkpointsDir: path.join(PRIVATE_DIR, "checkpoints", plan.plan_version),
});
const verified = verifyCalibrationEvidence({
  plan, prompts, tasks, attempts: store.listAttempts(), runs: store.listRuns(),
  checkpoint: store.readCheckpoint(), expectedRunnerRevision: buildRunnerRevision(),
});
if (verified.evidence === null) throw new Error(verified.failures.join("\n"));
const packet = buildBlindedAdjudicationPacket(verified.evidence, tasks);
if (packet.case_count > 0) {
  console.log(writeBlindedAdjudicationPacket({ evidence: verified.evidence, tasks, packet }));
} else {
  console.log("No inconclusive records; no review packet needed.");
}
NODE
```

The writer refuses to replace an existing packet. When a packet was created,
validate it, have the single reviewer enter decisions and rationales, then
require completeness:

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-adjudication.mjs
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/check-adjudication.mjs --require-complete
```

Manual decisions are secondary evidence. They do not rewrite automatic
results or replace the verified gate. Preserve failed evidence and design a
reviewed successor if calibration fails; design `3.0.0-frozen.1` only if it passes.

## Historical Execution Blocks

**Execution blocked:** `3.0.0-calibration.1` remains blocked from Live execution.
Its frozen validator does not re-derive all results from provider evidence.

**Execution blocked:** `3.0.0-calibration.2` remains blocked from Live execution.
The 2026-11-09 review reproduced fatal-stop resume, missing CLI clock and
unverified reporting defects. Google also redirects its frozen
`gemini-3.7-flash` model to `gemini-3.8-flash`, as documented in the
[official model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)
and [deprecation schedule](https://ai.google.dev/gemini-api/docs/deprecations).

Historical v2/.1/.2 artifacts stay intact. Ordinary readiness retains their
integrity checks. Calibration.2's 578-test historical v3 checkpoint and
USD 2.4957045 estimate did not establish executable or approved Live status.
Do not reuse an old approval variable or historical Live command.
