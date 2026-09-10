# Model And Cost Preflight

This preflight fixes the model panel, request settings, and maximum calibration
cost for `3.0.0-calibration.2`. It does not authorize Live provider requests.

Catalog check date: 2026-09-10.

## Frozen Model Panel

| Target | Exact model ID | Catalog maximum output | Current input / output USD per 1M tokens |
|---|---|---:|---:|
| `openai-frontier` | `gpt-5.6-sol` | 128,000 | `$4.00 / $20.00` |
| `anthropic-balanced` | `claude-sonnet-5` | 128,000 | `$2.00 / $10.00` |
| `google-stable-agentic` | `gemini-3.7-flash` | 65,536 | `$0.75 / $3.75` |

OpenAI's listed price is promotional and available at least through
2026-11-21; inputs above 272,000 tokens use its higher rate. Anthropic's
`$2.00 / $10.00` rate is the current standard first-party API price; its
previously planned 2026-09-01 increase will not occur. Google's
`$0.75 / $3.75` promotional price applies through 2026-12-31, with announced
`$1.50 / $7.50` pricing from 2027-01-01.

Official sources:

- OpenAI: <https://developers.openai.com/api/docs/models/gpt-5.6-sol>
- Anthropic model: <https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5>
- Anthropic pricing: <https://platform.claude.com/docs/en/about-claude/pricing>
- Google model: <https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash>
- Google pricing: <https://ai.google.dev/gemini-api/docs/pricing>

## Request Settings

Every request uses prompt-only JSON, no schema-constrained output, no sampling
parameters, no prompt caching, and no tools. Google also disables grounding.
Each request has an 8,192-token output ceiling. OpenAI uses
`max_output_tokens: 8192` and `reasoning.effort: medium`; Anthropic uses
`max_tokens: 8192` and adaptive thinking; Google uses
`generation_config.max_output_tokens: 8192` and medium thinking.

## Calibration Ceiling

The private metric packet is evaluated as `ceil(prompt characters / 4)` for
each request. The 10% input contingency is rounded up for each request before
provider aggregation. This produces 114,678 estimated input tokens, 126,162
input tokens at ceiling, 196,608 output tokens at ceiling, and 322,770 total
tokens at ceiling.

| Scope | Requests | Input ceiling | Output ceiling | Cost ceiling |
|---|---:|---:|---:|---:|
| Whole calibration | 24 | 126,162 | 196,608 | `$2.4957045` |
| `openai-frontier` | 8 | 42,054 | 65,536 | `$1.478936` |
| `anthropic-balanced` | 8 | 42,054 | 65,536 | `$0.739468` |
| `google-stable-agentic` | 8 | 42,054 | 65,536 | `$0.2773005` |

Costs are calculated separately with each provider's own current rates and
token accounting, then summed in USD. The ceiling excludes retries, tax,
discounts, caching, and price changes after the catalog check date. This
checkpoint fixes inputs for Task 6B; it neither freezes the package nor
authorizes a provider request.
