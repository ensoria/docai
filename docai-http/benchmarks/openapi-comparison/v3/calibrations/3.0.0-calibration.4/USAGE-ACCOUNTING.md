# Usage Accounting

Status: Task4 policy and Task5 native-evidence enforcement are scoped-accepted;
phase6A candidate model/pricing binding is scoped-accepted. Whole-package6B,
actual7B freeze and separate Live approval remain pending.
Documentation checked 2026-11-11, public research only. No inference,
credentials, account lookup, or model-availability claim was used.
Anthropic version-specific follow-up checked 2026-11-13; see below. On
2026-11-13 the maintainer explicitly approved Option A: the bounded single fixed
non-beta request policy, with evidence-preserving unknown/unpriced accounting
and a required stop on unexpected Anthropic iterations. This scope approval
does not authorize Live requests, models, prices or an API-version change.

## Reviewed Field Rules

### OpenAI Responses

Policy: `calibration4-openai-responses-default30m-v2`.

`input_tokens` includes cached reads and writes. Ordinary input is input minus
both subsets. `cache_write_tokens_details.ttl_30m_tokens` and `ttl_12h_tokens`
are disjoint and must sum to aggregate `cache_write_tokens`; never add the
aggregate again. Without a duration breakdown, this adapter's unmodified cache
settings use the documented 30-minute default (1,800 seconds). Twelve-hour
writes are 43,200 seconds. Write prices are total category prices, not
surcharges. Rates must be explicit, not derived by the billing function.

`output_tokens` already includes `output_tokens_details.reasoning_tokens`.
The latter is subtracted only to expose the final-output subtotal, never added
to output. Missing reasoning details leave subtotals null without preventing
pricing of a known generated total. A supplied total must equal input plus
generated output.

Sources: [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching),
[Responses reference](https://developers.openai.com/api/reference/resources/responses/methods/create),
[Reasoning](https://developers.openai.com/api/docs/guides/reasoning).
The [GPT-5.6 Sol page](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
was also inspected, but does not authorize a candidate model or price here.

### Anthropic Messages

Policy: `calibration4-anthropic-messages-2023-06-01-default5m-v2`.

Total input is `input_tokens + cache_creation_input_tokens +
cache_read_input_tokens`. `cache_creation.ephemeral_5m_input_tokens` and
`ephemeral_1h_input_tokens` replace the aggregate write component and must sum
to it. Without that breakdown, aggregate writes use the documented default
five-minute policy (300 seconds); reported one-hour writes use 3,600 seconds.
These are distinct price categories. Cache reads have no reported lifetime.

Output includes thinking. On 2026-11-13 the version-selected official reference
was verified as `2023-06-01`, unlike the default `2026-10-21` reference.
`output_tokens_details.thinking_tokens` is reported reasoning already included
in billed output, not an extra charge. Its re-tokenized count can differ from
the generation count, so this policy retains it as `reasoning_tokens` but never
fabricates an exact final-output subtotal: `final_output_tokens` stays null.
Absent detail remains null, not zero; malformed or oversized thinking counts
are invalid. New detail fields still block complete accounting.

The fixed request sends no beta header, tools, compaction, fallback or advisor
configuration. `iterations` remains unknown with null pricing, not discarded or
summed onto top-level totals. Official feature docs explain differing overlap:
executor message iterations roll into top-level counts; compaction is excluded;
advisor iterations are excluded and use another model's rates. The exact
standard-version relationship for an unexpected `iterations` field in this
fixed non-beta request is not established by the fetched reference. No assertion
is made that it cannot appear. Under maintainer-approved Option A (2026-11-13),
such usage is outside the accepted accounting domain: retain all native
evidence, keep accounting unknown and cost null, and safely stop subsequent
sends without replaying the response-bearing request. This is an approved
bounded-policy disposition, not general support for iteration billing.
Server tools and nonstandard speed/tier/geography also block acceptance.

Sources: [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching),
[Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking),
[2023-06-01 Messages reference](https://platform.claude.com/docs/en/api/messages/create?version=2023-06-01),
[2023-06-01 output-detail type](https://platform.claude.com/docs/en/api/http/messages?version=2023-06-01),
[Thinking costs](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost),
[Versioning](https://platform.claude.com/docs/en/api/versioning),
[Compaction usage](https://platform.claude.com/docs/en/build-with-claude/compaction-threshold#understanding-usage),
[Advisor usage](https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool),
[Beta reference](https://platform.claude.com/docs/en/api/beta/messages/create).

### Google

Policy: `calibration4-google-text-no-tools-v2`.

Interactions `total_output_tokens` excludes `total_thought_tokens`; generated
output is their sum. `total_input_tokens` includes `total_cached_tokens`,
which is a cache-read subset. GenerateContent's corresponding fields are
`candidatesTokenCount`, `thoughtsTokenCount`, `promptTokenCount`, and
`cachedContentTokenCount`. These two native naming families must not be mixed.
Modality breakdowns are explanatory, not additional billing components.

Implicit caching can apply without request cache options. Cached-read rates
must be explicit; no cache-write/storage category is invented. Missing cache
or thought counters remain unknown. Nonzero tool-use counts and non-text
modalities are outside this policy. Multiple response usage envelopes are
ambiguous and yield unknown accounting with all original envelopes retained.

Sources: [Interactions reference](https://ai.google.dev/api/interactions-api),
[GenerateContent reference](https://ai.google.dev/api/generate-content),
[Token counts](https://ai.google.dev/gemini-api/docs/tokens),
[Caching](https://ai.google.dev/gemini-api/docs/caching).

## Interfaces

`normalizeProviderUsage({provider,nativeUsage})` returns exactly:

```text
usage_version: "2"
policy_id, provider
input_tokens, output_tokens, total_tokens, native_total_tokens
total_provenance: "native" | "derived" | "unknown"
input_components: [{kind, tokens, ttl_seconds, pricing_key}]
reasoning_tokens, final_output_tokens, reasoning_in_output
accounting_status: "complete" | "unknown" | "invalid"
issues: string[]
```

`reasoning_in_output` describes inclusion in the native output field, not
whether reasoning should be added again to normalized output. Counts are
nonnegative safe integers or null. Unknown amounts are never synthesized as
zero. An absent native total can be derived only from both known normalized
totals. Malformed counters become null in an invalid ledger; native evidence
is retained unchanged in the adapter's raw response (apart from credential
redaction). Invalid totals are not repaired. Unsupported fields block complete
accounting even when their values appear harmless.

`validateUsageLedger(ledger) -> {valid,issues}` checks exact v2 shape, policy,
disjoint component categories, inclusion and total consistency. Typed unknown
ledgers can be valid; invalid accounting is not valid. A legacy three-key
object cannot satisfy this interface. This validator cannot authenticate a
stored ledger: execution verification must recompute from native evidence.

`priceUsage({usage,pricing}) -> {status,estimated_usd,issues}` takes:

```text
pricing = {
  provider, policy_id, model_resolution_id,
  usd_per_million_tokens: {
    input_uncached, input_cache_read,
    input_cache_write_1800s, input_cache_write_43200s, // OpenAI
    input_cache_write_300s, input_cache_write_3600s,   // Anthropic
    output
  }
}
```

Only the applicable categories are required. Every emitted component requires
an explicit rate, even for zero tokens; a present zero rate is allowed, missing
or null rates are unknown. Rates must be finite nonnegative numbers. Billing
adds each disjoint input charge and generated output charge once and returns
the unrounded sum divided by one million. Unknown or invalid accounting never
returns a numerical estimate. Display rounding belongs to the presentation
layer, never the budget-stop accumulator.

`model_resolution_id` is an explicit packet identifier, not a model-name
resolver. The later authority must validate it against the actual requested
and resolved model, settings, rate tiers, dates and sources. These standalone
helpers perform no catalog lookup and authorize nothing. The draft
`estimate-cost.mjs` remains deliberately unavailable.

## Completion And Errors

All request bodies cap generated tokens at 16,384; OpenAI medium effort,
Anthropic adaptive thinking and Google medium thinking remain unchanged.
Completion is separate from accounting. OpenAI/Google `completed`, Anthropic
`end_turn`/`stop_sequence`, and legacy Google `STOP` are accepted only in the
absence of conflicting or unknown signals. Original status/stop values remain
available. Other states, truncated output and unknown stops are incomplete;
they are not repaired, replayed or retried.
Every non-null supplied stop signal participates, including all candidate
`finishReason` values. Differing simultaneous stops are conflicting even when
each alone would be accepted. The deterministic primary `stop_reason` is the
first populated value in this order: `incomplete_details.reason`, `stop_reason`,
`stopReason`, then candidates in array order. This display precedence never
suppresses other signals during the completion decision; raw evidence retains
all values.

HTTP errors retain redacted `raw_response`/`response_body`, UsageLedger and
provider `completion`; error-classification `stop_reason` stays separate.
Missing usage on an HTTP failure is unknown, never evidence of a free request.
Response-bearing errors remain nonretryable. A transport/read failure without
a usable body retains the existing transport error classification; its possible
charge and stopping implications require execution-layer policy review.

Completion sources: [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create),
[Anthropic stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons),
[Google Interactions](https://ai.google.dev/api/interactions-api).

## Acceptance Boundaries

- Policy IDs bind this reviewed mapping and fixed request defaults, not all
  generations of each provider. Changed settings/native fields require review.
- Anthropic thinking details are supported for the pinned API version without
  inferring exact final tokens. Iteration-bearing shapes remain explicitly
  outside the accepted domain under maintainer-approved Option A dated
  2026-11-13: single fixed non-beta request, no tools, compaction, advisor or
  fallback options. Any `iterations` member, including null or empty values,
  remains unknown/unpriced with native evidence retained. Approval does not
  waive unknown fields or assert that iterations cannot appear.
- Scoped-accepted Task5 runner/verifier integration recomputes accounting from native
  evidence, enforces this approved boundary, durably retains the unknown/unpriced
  attempt and stop condition, and prevents subsequent sends, including on resume
  or re-entry. It must not retry/replay response-bearing work or substitute zero
  cost. Execution-layer enforcement belongs to Task5, not standalone Task4
  helpers; scoped acceptance is not whole-package, freeze or Live authorization.
- Exact candidate support for adaptive/medium reasoning and the 16,384 cap,
  provider model availability, current prices, tier thresholds, geography,
  promotion dates and policy/packet binding remain for candidate authorization.
- Hostile JavaScript objects are rejected before getters/coercion/Proxy traps.
  JSON counters, including overflow/nonfinite values, become typed accounting
  failures instead of fabricated counts.
