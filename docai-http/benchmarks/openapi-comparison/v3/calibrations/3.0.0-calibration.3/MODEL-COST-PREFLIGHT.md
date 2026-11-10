# Calibration 3 Model And Cost Preflight

Public catalogs checked: **2026-11-10**. No inference, authenticated model-list
request, account-access probe or credential-value inspection was performed.
This is a preparation packet, not permission to spend or proof of account access.

## Exact Panel And Settings

| Provider / exact model | Input / output limit | USD per million input / output | Preserved settings |
| --- | --- | --- | --- |
| OpenAI `gpt-5.6-sol` | 1,050,000 / 128,000 | 4 / 20 | Responses API, `reasoning.effort=medium`, `max_output_tokens=8192` |
| Anthropic `claude-sonnet-5` | 1,000,000 / 128,000 | 2 / 10 | Messages API, `thinking.type=adaptive`, `max_tokens=8192` |
| Google `gemini-3.8-flash` | 1,048,576 / 65,536 | 0.75 / 3.75 | Interactions API, `generation_config.thinking_level=medium`, `generation_config.max_output_tokens=8192` |

All omit sampling parameters, tools, schema-constrained output and explicit
prompt caching; Google grounding remains off. JSON is requested by the same
prompt-only comparison contract. Model roles, tasks, four conditions,
24 unique requests, 100-attempt ceiling and 23/1 gate are unchanged.

Sources checked today:

- [OpenAI exact model](https://developers.openai.com/api/docs/models/gpt-5.6-sol):
  exact ID, limits, medium reasoning, Responses support and current rates.
- [OpenAI Responses reference](https://developers.openai.com/api/reference/resources/responses/methods/create.md):
  `max_output_tokens` includes visible and reasoning output. The rendered
  reference exceeds the browser reader's size limit; the public Markdown was
  fetched without authentication to confirm the request field, not an API call.
- [Claude Sonnet 5 overview](https://platform.claude.com/docs/en/models/sonnet-5/overview):
  exact legacy ID, limits, adaptive thinking and rates; sampling fields are
  rejected. Active legacy, retirement no sooner than 2027-06-30.
- [Claude thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost):
  adaptive behavior and reasoning cost accounting; default effort remains
  provider default (no new effort override).
- [Google exact model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash):
  stable exact ID, limits and low/medium/high thinking; minimal is unsupported.
- [Google pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.8-flash):
  current Standard paid rates and announced January change; thinking is output.
- [Google Interactions](https://ai.google.dev/gemini-api/docs/interactions):
  the approved `generation_config` boundary; no endpoint or role change.
- [Google Interactions API reference](https://ai.google.dev/api/interactions-api):
  `thinking_level` and `max_output_tokens` request fields, checked as public
  Markdown without authentication.

Google public Markdown was fetched with unauthenticated `curl` because the
browser reader cannot render that content type. Supplementary public request
references must also be rechecked before Live approval if API behavior changes.
Never substitute an alias or follow a model migration as if it were this panel.

## Estimates And Stop Thresholds

New `.3` canonical private prompts and metrics supply these calculations:

| Provider | Requests | Input estimate | Input with contingency | Requested output | Total threshold allocation | Estimated USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| OpenAI | 8 | 38,226 | 42,054 | 65,536 | 107,590 | 1.4789360 |
| Anthropic | 8 | 38,226 | 42,054 | 65,536 | 107,590 | 0.7394680 |
| Google | 8 | 38,226 | 42,054 | 65,536 | 107,590 | 0.2773005 |
| Total | 24 | 114,678 | 126,162 | 196,608 | 322,770 | 2.4957045 |

For every full rendered prompt, estimate `ceil(Unicode characters / 4)`;
apply 10% and round each request up before summing. This is a descriptive
character heuristic, not any provider tokenizer count or guaranteed input
upper bound. The same English/text payloads and unchanged heuristic are
retained; no new tokenizer validity claim is made. Each provider is calculated
independently at its own rates and accounting, even where estimates coincide.
Output is capped at 8,192 requested tokens per call, including provider-accounted
thinking/reasoning, not a guarantee of 8,192 visible answer tokens.

`cost_ceiling_usd` and token `*_ceiling` fields retain their versioned names.
Operationally the runner uses **reported-usage stop thresholds** of 322,770
total tokens and USD 2.4957045 across retained response attempts. The table's
provider rows are cost allocations, not independent provider billing caps.
These are **not hard billing caps**. A request in flight can overshoot a
threshold; retries consume additional calls/tokens, and transport/error usage
may be unknown. Unknown usage is not free usage. Taxes, negotiated discounts,
cache effects, retry overhead and changed prices are outside this estimate.
The approved runner/report/stop accounting is unchanged.

## Expiry And Approval Limits

- OpenAI promotion ends 2026-11-30; later rates are not asserted. Above
  272,000 input tokens per request, published multipliers are 2x input / 1.5x
  output. Canonical character estimates are below that boundary, not tokenizer
  proof that a real request cannot cross it.
- Google promotion ends 2026-12-31. From 2027-01-01 rates are 1.50 / 7.50;
  this packet must not be reused as a current-price approval after expiry.
- Anthropic's current legacy rate is 2 / 10 with no announced price expiry
  established by today's overview; recheck availability and rates before Live.
- Public freeze integrity is historical byte identity, not current model
  routing, price freshness, private-input availability or execution approval.
  Missing private inputs block private-required validation and Live preflight.
  Expired/changed catalogs block a current operator approval packet even when
  public historical integrity still passes. There is no automatic freshness
  override or model replacement; a changed frozen contract needs a new identity.

Task 5 whole-package review and explicit user Live confirmation are still
required. No actual budget-policy or comparison-semantic change is introduced.
