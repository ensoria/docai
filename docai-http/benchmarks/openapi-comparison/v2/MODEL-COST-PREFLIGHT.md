# Model And Cost Preflight

This document records the model and cost choices that require human approval
before OpenAPI comparison benchmark v2 can be frozen. It is adoption evidence,
not part of the DocAI HTTP `1.0.0` compatibility boundary.

Catalog and price check date: 2026-08-24.

Decision status: prompt-only JSON revision approved and frozen on 2026-08-24.

## Recommended Model Panel

| Target | Proposed model | Rationale | Conservative ceiling input / output USD per 1M tokens |
|---|---|---|---:|
| `openai-frontier` | `gpt-5.6-sol` | Current OpenAI flagship for complex reasoning and coding; matches the preregistered frontier role. | `$5.00 / $30.00` |
| `anthropic-balanced` | `claude-sonnet-5` | Current generally available Sonnet model; matches the preregistered balance of capability and speed. | `$3.00 / $15.00` |
| `google-stable-agentic` | `gemini-3.6-flash` | Current generally available Flash model for agentic work; it supersedes the draft's `gemini-3.5-flash` choice. | `$1.50 / $7.50` |

Official references:

- OpenAI model and pricing:
  <https://developers.openai.com/api/docs/models/gpt-5.6-sol>
- Anthropic model:
  <https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5>
- Anthropic pricing:
  <https://platform.claude.com/docs/en/about-claude/pricing>
- Google model:
  <https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash>
- Google pricing:
  <https://ai.google.dev/gemini-api/docs/pricing>

OpenAI lists promotional GPT-5.6 Sol pricing of `$4 / $20` through at least
2026-11-21. The benchmark retains the earlier `$5 / $30` ceiling. Anthropic
lists introductory Sonnet 5 pricing through 2026-08-31. The benchmark
ceiling uses the later `$3 / $15` standard price so approval remains sufficient
if execution crosses that date. Google lists introductory Gemini 3.6 Flash
pricing through 2026-12-31; the benchmark uses the later `$1.50 / $7.50`
standard price. Actual provider-reported usage and cost signals will still be
recorded per batch.

## Proposed Request Settings

- Require JSON through the shared prompt only and enforce the exact output
  contract in the provider-neutral local grader. Do not enable provider schema
  constraints or provider-specific JSON modes.
- Omit `temperature`, `top_p`, and `top_k`.
- Use the provider's balanced/recommended reasoning mode:
  OpenAI `medium`, Anthropic adaptive thinking, and Google `medium`.
- Set a hard output ceiling of 4,096 tokens per request, including billable
  reasoning tokens where the provider counts them as output.
- Do not use prompt caching, Batch API discounts, tools, or grounding in the
  primary run.
- Apply a 10% contingency to the deterministic characters/4 input estimate.

The output ceiling is deliberately larger than the hand-authored positive
results, but far below each model's platform maximum. It reduces truncation
risk without treating a model's very large maximum output as a plausible
benchmark expense.

## Conservative Cost Ceiling

The current 648 exported prompts contain an estimated 2,013,219 input tokens
before contingency, or 2,214,873 after applying 10%. The 4,096-token limit
produces a worst-case output ceiling of 2,654,208 tokens.

| Scope | Requests | Cost ceiling |
|---|---:|---:|
| Whole primary pilot | 648 | `$53.46` |
| `openai-frontier` | 216 | `$30.23` |
| `anthropic-balanced` | 216 | `$15.49` |
| `google-stable-agentic` | 216 | `$7.74` |
| `b01` | 72 | `$6.12` |
| `b02` | 72 | `$5.89` |
| `b03` | 72 | `$5.81` |
| `b04` | 72 | `$6.12` |
| `b05` | 72 | `$5.89` |
| `b06` | 72 | `$5.81` |
| `b07` | 72 | `$6.12` |
| `b08` | 72 | `$5.89` |
| `b09` | 72 | `$5.81` |

Values are rounded to two decimals for display. The machine-readable estimate retains
six decimal places. These ceilings exclude transport retries, tax, optional
ablation runs, and provider-side pricing changes. A batch must stop if the
projected spend exceeds its frozen estimate by more than 20%.

## Google Alternative

`gemini-3.5-flash-lite` would reduce the calculated whole-pilot ceiling by
about `$5.31` and the `b01` ceiling by about `$0.62`.

Advantages:

- lower list price;
- intended for high-volume structured extraction and automation.

Disadvantages:

- it changes the target from a balanced agentic model to a cost-optimized
  lightweight model;
- the resulting panel is less aligned with the preregistered target role and
  may make quality differences harder to interpret.

The recommended choice is therefore `gemini-3.6-flash`. Cost is already bounded
by the nine-batch approval gates, while preserving a stronger cross-provider
capability comparison matters more than the roughly five-dollar maximum
saving.

## Approval Record

The user approved:

1. the three proposed model IDs;
2. the provider-balanced reasoning settings;
3. the 4,096 output-token limit and 10% input contingency; and
4. the conservative `$6.13` authorization for `b01`, which remains above the
   revised frozen estimate of `$6.124346`.

This approval freezes the settings; it does not authorize a Live LLM request.
Separate explicit approval remains required before executing `b01`, and again
after every completed batch.
