# Calibration 3 Live Results

## Decision

The maintainer approved the frozen `3.0.0-calibration.3` Live envelope on
2026-11-10. All 24 scheduled calls received provider responses, with no
retries or terminal provider/access errors. Evidence verification passed,
but the preregistered reliability gate **failed**. Do not start the primary
benchmark or rerun this calibration to replace its outcome.

This is pipeline calibration, not evidence that either documentation format
is superior. Preserve the Live-used package, prompts, manifest, attempts,
runs and checkpoint. Any correction requires a separately reviewed successor
identity and new approval before inference.

## Verified Outcome

| Measure | Observed | Required |
|---|---:|---:|
| Scheduled / retained runs | 24 / 24 | 24 / 24 |
| Provider calls / responses | 24 / 24 | All identities accounted for |
| Automatic decisions | 16 | At least 23 |
| Exceptional runs | 8 | At most 1 |
| Incomplete responses | 4 | 0 |
| Semantic passes / fails | 0 / 16 | Diagnostic only |
| Runtime-recorded implementation defects | 0 | 0 |
| Runs requiring manual adjudication | 0 | Conditional only |

Each provider completed eight calls: two tasks across all four conditions.
Resolved models matched `gpt-5.6-sol`, `claude-sonnet-5`, and
`gemini-3.8-flash`. The checkpoint is `complete`, with no unresolved
in-flight intent. Completion of the schedule does not imply a passing gate.

| Provider | Upload task (4 conditions) | Workflow task (4 conditions) |
|---|---|---|
| OpenAI | Valid contract; semantic fail | Valid contract; semantic fail |
| Anthropic | Valid contract; semantic fail | Invalid output contract |
| Google | Valid contract; semantic fail | Incomplete provider response |

The gate reports three failures: incomplete responses, insufficient automatic
coverage, and too many exceptional runs. Its token-limit-completion check
is true because the retained incomplete Google responses have no recognized
stop-reason value; that does not override the incomplete-response failure.

## Findings And Limits

1. **Google output budget:** All four workflow responses have provider status
   `incomplete`. Their visible output counts are 323-328 tokens and thinking
   counts are 7,860-7,865 tokens. Every Google call used
   `thinking_level: medium` and `max_output_tokens: 8192`. Budget exhaustion is
   strongly suggested by these counts, but the retained response provides no
   explicit stop reason. Google's [thinking documentation](https://ai.google.dev/gemini-api/docs/thinking)
   explains that thinking and final output share this limit and an exhausted
   budget can produce an incomplete response. Do not parse partial output as
   a completed answer or retry only the failed cells.
2. **Anthropic contract mismatch:** All four workflow outputs include a
   top-level `schema_version`, which the answer schema forbids. The public
   output instruction displays `schema_version` as metadata alongside the
   actual schema. This is a plausible source of confusion, not proof of the
   model's internal reasoning. Audit the instruction/schema relationship in
   a successor; do not remove the key from retained answers or relax this
   calibration's contract after observing results.
3. **Semantic diagnostics:** All 16 contract-valid answers failed frozen
   assertions. All 12 upload answers missed the exact expected content-type
   string `multipart/form-data; boundary=<library-generated>`. Workflow
   assertions also compare paths, state labels, placeholders and recovery
   structures. Audit which requirements are publicly specified, derivable
   from the supplied documentation, or merely equivalent representations.
   These scores are not yet a sound public comparative-accuracy claim.
4. **No manual-review shortcut:** No run requests manual adjudication. Contract
   violations and incomplete responses are not inconclusive semantic cases
   to be turned into automatic passes through human review.

## Usage And Cost Caveat

| Provider | Normalized input | Normalized output | Provider total | Separate Google thinking |
|---|---:|---:|---:|---:|
| OpenAI | 32,115 | 13,708 | 45,823 | Not applicable |
| Anthropic | 47,189 | 25,723 | 72,912 | Not applicable |
| Google | 37,108 | 2,239 | 102,239 | 62,892 |
| Total | 116,412 | 41,670 | 220,974 | 62,892 |

Google's raw usage separates `total_thought_tokens` from `total_output_tokens`.
The frozen normalizer retains the latter as output, while the USD stop
calculation multiplies only normalized input/output by their rates. It
therefore omits Google thinking from that dollar calculation; the reported
total-token stop calculation still includes it. Zero runtime-recorded
implementation defects does not certify correct billing normalization.

At the frozen standard rates, the normalized-only calculation is USD
0.79045525. Including Google's thinking at the frozen output rate gives a
diagnostic estimate of **USD 1.02630025**: OpenAI 0.402620, Anthropic 0.351608,
Google 0.27207225. This is not an invoice or a provider-console reconciliation;
cache billing, credits, tax and other adjustments may differ. Both estimates
are below the approved USD 2.4957045 estimate threshold. Preserve the original
records rather than rewriting their usage fields.

## Next Work Before Any More Inference

- [x] Audit public answer instructions and private assertions together;
  distinguish required semantics from arbitrary exact spellings and record
  offline examples for acceptable and unacceptable representations in the
  [offline audit](OPENAPI-COMPARISON-V3-CALIBRATION3-AUDIT.md).
- [x] Select successor approach A: structured semantics and deterministic grading.
- [x] Approve the builder-reviewed
  [successor design](OPENAPI-COMPARISON-V3-CALIBRATION4-DESIGN.md).
- [ ] Review the [implementation plan](OPENAPI-COMPARISON-V3-CALIBRATION4-PLAN.md),
  confirm execution method and implement permanent regression tests without
  modifying calibration.3.
- [ ] Design and test a Google thinking/final-output allocation that can
  complete the workflow, with explicit completion diagnostics.
- [ ] Correct successor provider usage normalization and budget accounting;
  test separately reported thinking, caching and incomplete-response usage.
- [ ] Review and freeze a new calibration identity without changing .3's
  gate, evidence or immutable artifacts.
- [ ] Present the new request/token/cost envelope for separate approval.

No API-key setup or manual resend is currently required from the maintainer.
Optional provider-console billing reconciliation can confirm the actual
charge, but it does not change the failed reliability gate.

## Reproduction Checks

Use the frozen runtime under
`benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.3/runtime/`:

- `check-runs.mjs`: evidence verification succeeds.
- `check-gate.mjs`: exits 1 with the three gate failures above; expected.
- `freeze.mjs --check --private-required`: verifies immutable public/private
  artifacts without making inference calls.

Private run evidence remains local under the package's configured private
directories. This summary does not publish prompts or full model answers.
