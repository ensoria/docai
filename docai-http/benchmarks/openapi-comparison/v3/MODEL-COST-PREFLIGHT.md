# Model And Cost Preflight

This preflight fixes the model panel, request settings, and maximum calibration
cost for `3.0.0-calibration.1`. It does not authorize Live provider requests.

Catalog check date: 2026-09-03.

## Frozen Model Panel

| Target | Exact model ID | Catalog maximum output | Current input / output USD per 1M tokens |
|---|---|---:|---:|
| `openai-frontier` | `gpt-5.6-sol` | 128,000 | `$4.00 / $20.00` |
| `anthropic-balanced` | `claude-sonnet-5` | 128,000 | `$2.00 / $10.00` |
| `google-stable-agentic` | `gemini-3.7-flash` | 65,536 | `$0.75 / $3.75` |

The calibration ceiling uses the standard first-party API prices effective on
the catalog check date. OpenAI documents the current promotional price as
available at least through 2026-11-21. Google's `$0.75 / $3.75` promotional
price applies through 2026-12-31; its announced 2027 price is
`$1.50 / $7.50`. A later primary freeze must check the catalogs again and must
not silently reuse these dated rates.

Official sources:

- OpenAI model and limits:
  <https://developers.openai.com/api/docs/models/gpt-5.6-sol>
- OpenAI request guidance and reasoning levels:
  <https://developers.openai.com/api/docs/guides/latest-model>
- Anthropic Sonnet 5 model behavior:
  <https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5>
- Anthropic pricing:
  <https://platform.claude.com/docs/en/about-claude/pricing>
- Anthropic adaptive thinking:
  <https://platform.claude.com/docs/en/build-with-claude/effort>
- Google current model guidance:
  <https://ai.google.dev/gemini-api/docs/latest-model>
- Google model and limits:
  <https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash>
- Google pricing:
  <https://ai.google.dev/gemini-api/docs/pricing>
- Google Interactions API request fields:
  <https://ai.google.dev/api/interactions-api>

## Request Settings

Every request has an 8,192-token output ceiling and uses prompt-only JSON.
Provider schema-constrained output, sampling parameters, prompt caching, and
tools are disabled or omitted. Grounding is also disabled for Google.

The provider wire settings are:

- OpenAI Responses API: `max_output_tokens: 8192` and
  `reasoning.effort: medium`.
- Anthropic Messages API: `max_tokens: 8192` and
  `thinking.type: adaptive`.
- Google Interactions API: `generation_config.max_output_tokens: 8192` and
  `generation_config.thinking_level: medium`.

The machine-readable model packet records the provider field names as well as
the common 8,192-token calibration ceiling. The adapters are frozen with that
packet, so a model or request-setting substitution fails validation.

## Calibration Ceiling

The 24 rendered prompts contain 114,678 estimated input tokens using
`ceil(characters / 4)` per prompt. Applying 10% contingency and rounding each
request up gives 126,162 input tokens. The 8,192-token request limit gives a
196,608-token output ceiling and a 322,770-token combined ceiling.

| Scope | Requests | Input ceiling | Output ceiling | Cost ceiling |
|---|---:|---:|---:|---:|
| Whole calibration | 24 | 126,162 | 196,608 | `$2.4957045` |
| `openai-frontier` | 8 | 42,054 | 65,536 | `$1.478936` |
| `anthropic-balanced` | 8 | 42,054 | 65,536 | `$0.739468` |
| `google-stable-agentic` | 8 | 42,054 | 65,536 | `$0.2773005` |

Costs are calculated separately with each provider's own input/output token
accounting and current rates, then summed in USD. Token counts and prices are
not normalized or pooled across providers. The ceiling excludes retries, tax,
discounts, caching, and future price changes. Any transport retry still counts
toward the 100-attempt work-step cap and must remain within the separately
approved execution budget.

The 24-request calibration is the approved exception to the normal 50-to-100
request work-step target. Live execution still requires explicit approval for
this exact plan identity and ceiling.
