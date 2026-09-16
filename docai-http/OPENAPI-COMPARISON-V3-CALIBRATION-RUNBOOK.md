# OpenAPI Comparison v3 Calibration Runbook

This runbook retains the blocked `3.0.0-calibration.1` history and records the
operator handoff for frozen `3.0.0-calibration.2`. It does not authorize
provider calls, create private run state, or authorize a primary benchmark
schedule.

> **Execution blocked:** do not execute `3.0.0-calibration.1`. Final review
> found that its retained-run validator checks record structure and transport
> state but does not recompute parsing, contract validation, and grading from
> each retained provider response. Because the affected checker, runner,
> parser, grader, and gate are frozen artifacts, the correction requires a new
> calibration identity rather than a change to this one.

> **Calibration 2 frozen, not authorized:** 3.0.0-calibration.2 is frozen
> and has passed its deterministic freeze review. It is ready only for a
> separate, explicit Live approval covering this exact envelope.

A passing general readiness check is not authorization for Live execution.

## Frozen Calibration 2 Envelope

- Requests: exactly 24.
- Models: `gpt-5.6-sol`, `claude-sonnet-5`, and `gemini-3.7-flash`.
- Combined token ceiling: 322,770 tokens.
- Cost ceiling: USD 2.4957045.

The 24-request calibration is a planned exception to the normal 50-to-100
request work-step target. It is fixed non-primary reliability evidence that
must complete and pass its gate before `3.0.0-frozen.1` or any primary batch
can be proposed. It remains separately subject to explicit Live approval for
this exact plan, models, token ceiling, and cost ceiling.

## Preflight And Dry Run

Run the package-local deterministic frozen-boundary checks first. These public
checks intentionally omit `--private-required` and require no private provider
response, run, checkpoint, or adjudication files.

```sh
node docai-http/tools/check-openapi-comparison-v3-calibration2-plan.mjs --frozen
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/freeze.mjs --check
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-parity.mjs
node docai-http/tools/check-release-readiness.mjs
```

Ordinary release readiness also retains the historical
`3.0.0-calibration.1` frozen plan, public freeze, and parity checks. Those
checks prove only its byte integrity; its execution block remains in force.

Then validate the runner without provider calls:

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/run-calibration.mjs --dry-run
```

The public plan and freeze checks validate the three exact models, the
322,770-token ceiling, and the USD 2.4957045 cost ceiling. Confirm separately
that the dry run reports the plan identity, 24-request ceiling, 100-attempt
ceiling, API-key presence without values, and zero provider calls. These checks
confirm deterministic readiness only and grant no Live authorization.

## Approval-Gated Live Execution

The following command is a future operator handoff, not an instruction to run
it now. Run it only after a separate, explicit Live approval for
`3.0.0-calibration.2` and the frozen envelope above. The runner performs the
private-required freeze, prompt, model, cost, key-presence, and approval
preflight before it can call a provider.

```sh
DOCAI_LIVE_LLM_APPROVED_CALIBRATION=3.0.0-calibration.2 \
  node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/run-calibration.mjs --execute
```

Do not substitute the `.1` identity, add another mode, or infer approval from
the public preflight. Stop and report any preflight, retained-evidence,
provider, budget, or attempt-ceiling failure.

## Verified Run And Gate Checks

After an approved Live run stops or completes, verify that every retained run
is re-derived from its retained provider evidence before reading its status:

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-runs.mjs
```

Only after the verified run check completes without failures, evaluate the
frozen reliability gate:

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-gate.mjs
```

The gate requires all 24 canonical identities, at least 23 automatic
decisions, and no more than one exceptional run. Calibration evidence remains
non-primary regardless of the result.

## Conditional Adjudication

Adjudication applies only when verified automatic `inconclusive` records
exist. Build and write the blinded packet in one process from genuine verified
evidence with the frozen APIs. Run the following command from the repository
root only after `check-runs.mjs` succeeds and confirms inconclusive records:

```sh
node --input-type=module <<'NODE'
import path from "node:path";

import {
  buildBlindedAdjudicationPacket,
  writeBlindedAdjudicationPacket,
} from "./docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/adjudication.mjs";
import { readTaskPacket } from "./docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/contract.mjs";
import { verifyCalibrationEvidence } from "./docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/evidence-verifier.mjs";
import { PRIVATE_DIR, readPlan } from "./docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/paths.mjs";
import { buildCalibrationPrompts } from "./docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/prompt.mjs";
import { buildRunnerRevision, FileRunStore } from "./docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/runner.mjs";

const plan = readPlan();
const taskPacket = readTaskPacket(plan);
const tasks = taskPacket.tasks.filter((task) => plan.calibration.task_ids.includes(task.id));
const prompts = buildCalibrationPrompts({ plan, packet: taskPacket });
const store = new FileRunStore({
  runsDir: path.join(PRIVATE_DIR, "runs", plan.plan_version),
  checkpointsDir: path.join(PRIVATE_DIR, "checkpoints", plan.plan_version),
});
const verification = verifyCalibrationEvidence({
  plan,
  prompts,
  tasks,
  attempts: store.listAttempts(),
  runs: store.listRuns(),
  checkpoint: store.readCheckpoint(),
  expectedRunnerRevision: buildRunnerRevision(),
});
if (verification.evidence === null) {
  throw new Error(`calibration evidence verification failed:\n- ${verification.failures.join("\n- ")}`);
}
const packet = buildBlindedAdjudicationPacket(verification.evidence, tasks);
const file = writeBlindedAdjudicationPacket({
  evidence: verification.evidence,
  tasks,
  packet,
});
console.log(`Wrote blinded adjudication packet: ${file}`);
NODE
```

The writer refuses to replace an existing packet. Verify the newly written
pending packet:

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-adjudication.mjs
```

After the one reviewer records every decision and rationale, require a
complete packet:

```sh
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.2/runtime/check-adjudication.mjs --require-complete
```

Manual decisions are secondary evidence. They do not rewrite automatic
results or replace the verified gate result.

## Historical Post-Run Commands

The following `3.0.0-calibration.1` commands validate structure and evaluate
stored result fields, but they do not establish that those fields were derived
from the retained provider responses. They are retained for auditability and
must not be used to approve this calibration:

```sh
node docai-http/tools/check-openapi-comparison-v3-runs.mjs
node docai-http/tools/check-openapi-comparison-v3-calibration.mjs
```

Likewise, its conditional blinded one-reviewer packet remains historical only:

```sh
node docai-http/tools/openapi-comparison-v3-adjudication.mjs --write
node docai-http/tools/check-openapi-comparison-v3-adjudication.mjs --require-complete
```

The packet and source records stay in the ignored private directory. Its manual
decisions remain secondary evidence and do not replace automatic results.
