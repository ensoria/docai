# Candidate Model And Cost Preflight

Status: preparation candidate, checked 2026-11-13. Not freeze, account
availability, execution readiness or spending authorization. Plan remains draft
with null target model IDs and a disabled trust anchor.

| Target | Exact requested/resolved candidate | Reasoning | Generated cap |
| --- | --- | --- | ---: |
| openai-frontier | gpt-5.6-sol | medium | 16384 |
| anthropic-balanced | claude-sonnet-5 | adaptive, omitted effort/default high | 16384 |
| google-stable-agentic | gemini-3.8-flash | medium | 16384 |

No model/settings substitution. Prompt-only JSON, sampling and schema-constrained
output options omitted, no tools. Anthropic retains version 2023-06-01 and no
beta/compaction/advisor/fallback. Exact settings/limits/dates/sources/rates/policy
bindings are in model-resolutions.json. OpenAI's 1,050,000 context is not its
922,000 maximum input. Its candidate pricing scope is at most 272,000 input per
request; exceeding the selected tier is rejected, not repriced by inference.

## Official Evidence

Research checked 2026-11-13 using actual official pages, including OpenAI Docs:

- [OpenAI model](https://developers.openai.com/api/docs/models/gpt-5.6-sol),
  [explicit input limit](https://developers.openai.com/api/docs/models/gpt-5.6-sol.md),
  [pricing](https://developers.openai.com/api/docs/pricing),
  [lifetime-specific cache rates](https://developers.openai.com/api/docs/guides/prompt-caching),
  [Responses cap](https://developers.openai.com/api/reference/resources/responses/methods/create).
- [Anthropic model/rates](https://platform.claude.com/docs/en/models/sonnet-5/overview),
  [caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching),
  [thinking/cap](https://platform.claude.com/docs/en/build-with-claude/thinking),
  [thinking costs](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost),
  [pinned Messages version](https://platform.claude.com/docs/en/api/messages/create?version=2023-06-01).
- [Google model](https://aistudio.google.com/docs/models/gemini-3.8-flash),
  [its Standard paid rates](https://aistudio.google.com/docs/pricing#gemini-3.8-flash),
  [thinking and combined cap](https://aistudio.google.com/docs/thinking#token-limits),
  [Interactions](https://aistudio.google.com/api-reference/interactions-api).
  ai.google.dev model/pricing URLs redirect to these official documentation
  pages; this is not a model substitution or inference redirect check.

## Accounting And Projection

USAGE-ACCOUNTING.md and Task4's final Option A disposition are authority.
Disjoint USD per million token rates:

| Provider | Ordinary input | Cache read | Short write | Long write | Generated output |
| --- | ---: | ---: | ---: | ---: | ---: |
| OpenAI | 4 | 0.4 | 5 (1800s) | 10 (43200s) | 20 |
| Anthropic | 2 | 0.2 | 2.5 (300s) | 4 (3600s) | 10 |
| Google | 0.75 | 0.075 | not applicable | not applicable | 3.75 |

Writes are total category rates, not add-on charges. Inclusive generated output
includes thinking once. Anthropic observational thinking never fabricates an
exact final subtotal. Unexpected iterations remain unknown/unpriced under
calibration4-anthropic-messages-2023-06-01-default5m-v2; Task5 must stop durably.

Full rendered task + compact contract + documentation + system/role payloads
are measured in bytes/codepoints. Token estimates are ceil(codepoints/4), not
provider tokenizer counts. Per-request 10% contingency is rounded up separately
for each provider. All input-category extrema are priced through priceUsage;
the largest category covers mixtures of those disjoint categories. No second
independent billing formula is used and no cache-hit saving is assumed.

24 requests, eight/provider: 230544 approximate input, 253611 contingent input,
393216 requested generated allocation, **646827 projected token stop** and
**USD 5.67060075 projected cost stop**. Per provider: 84537 contingent input +
131072 generated = 215609 tokens; USD maxima OpenAI 3.46681, Anthropic 1.648868,
Google 0.55492275. Machine artifacts retain unrounded sums. Display decimals
are not budget accumulators. These are planning thresholds, not guaranteed
invoice caps: tokenization, request overhead and provider behavior may differ.

No extra retry allocation. Never treat a potentially billed unknown/error
attempt as zero; no response-bearing retry. Task5 must account for every
charge-bearing attempt, enforce no further sends and handle resume/re-entry.
Regional/FedRAMP/priority/Batch/Flex tiers, tools and explicit Google cache
storage are outside this standard/global fixed-request policy, not free.

The entire packet expires at 2026-11-30, OpenAI's earliest promotion end.
Google's promotion ends 2026-12-31; announced later input/read/output are
1.50/0.15/7.50, not an automatic fallback. Anthropic is active legacy and is not
retired before 2027-06-30. Recheck catalog/settings/prices before actual freeze.

## Consumer Contract And Safety

buildModelResolutions(plan), buildCostEstimate(options),
validateModelResolutions(plan,packet,options?) and
validateCostEstimate(plan,estimate,models,metrics,options?) are real candidate interfaces.
Validation checks reviewed data, exact model/settings/policy/rates, canonical
24-row schedule, metric consistency and full rebuilt estimate. It is not a Live
approval capability. Exact packet IDs bind all candidate parameters. Current
UTC date is used for validator expiry by default; explicit checkedOn is for
offline dated checks, not a fresh-research assertion.

For deterministic historical integrity checks, Task5/6B must pass an explicit
`{checkedOn: "2026-11-13"}` to both model and cost validators. The optional fifth
cost argument follows the model validator's closed date-options contract; it
does not change the candidate's validity window or rebuild timestamp. Dated
checks still reject tampered inputs and out-of-window dates, regardless of the
wall clock. Successful validation returns no execution capability.

For send eligibility, retain the original four-argument cost call and default
model call: both use current UTC and reject after 2026-11-30. Live preflight
already uses those defaults and accepts no checkedOn override. Never reuse a
historical verification date as a send clock; freeze and separate approval are
additional requirements, not substitutes for current-time expiry checks.

The estimator CLI is read-only. Existing prompt/context/check-plan builders
remain unchanged. Freeze must bind actual canonical prompt/metrics/source bytes;
Scoped-accepted Task5 validates actual native model identity and recomputes usage, not trusting
adapter fallback identity or an unattested caller-supplied ledger/metrics packet.
The accepted runner uses the shared native accounting policy and v2 pricing.

Remaining order: Task7A offline freeze implementation/review ->
Task6B integrated/historical suites and independent whole-package review ->
Task7B actual freeze. Separate explicit Live approval remains required later.
