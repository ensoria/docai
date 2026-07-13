# Contributing

## Live LLM Task Evaluation

DocAI HTTP live LLM task evaluation calls external model provider APIs. These runs may send selected evaluation prompts and fixture context to the provider, may incur API usage cost, and may be subject to provider account, quota, region, and model-access limits.

Before running live LLM evaluation tools, configure the needed API keys as environment variables in your local shell or secret manager:

```sh
export GOOGLE_API_KEY=...
export ANTHROPIC_API_KEY=...
export OPENAI_API_KEY=...
```

Current usage:

- `GOOGLE_API_KEY` is required for the Google Gemini runner, including `google-stable-agentic`.
- `ANTHROPIC_API_KEY` will be required for Anthropic targets such as `anthropic-balanced` and `anthropic-fast`.
- `OPENAI_API_KEY` will be required for OpenAI targets such as `openai-frontier` and `openai-cost`.

Do not commit real API keys, real bearer tokens, account IDs, provider raw logs, or real authorization headers. Reviewed evaluation records may include fake fixture placeholders such as `Bearer <access_token>` or `Bearer test_token_123` when they are part of the task output. Live result records under `docai-http/fixtures/complete-candidates/v0.11.0/evaluations/runs/` should contain only reviewed, publishable evaluation results and safe usage metadata.

For the full procedure, see `docai-http/LIVE-LLM-EVALUATION.md`.
