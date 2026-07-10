# Live Evaluation Run Records

This directory is for live LLM evaluation results. No live results have been recorded yet.

Use JSON Lines files named by task group, for example `request-construction.jsonl`. Each line records one target/task run:

```json
{"run_id":"openai-frontier__request-create-user-compact","target_id":"openai-frontier","task_id":"request-create-user-compact","provider":"openai","model":"gpt-5.6-sol","executed_at":"2026-07-11T00:00:00Z","status":"pass","review":{"matches_expected_outcome":true,"fixture_gap":false,"notes":"The response included POST /users, required headers, email/name body fields, and omitted optional role."},"response":{"content_json":{"method":"POST","path":"/users","headers":{"Authorization":"Bearer <access_token>","Content-Type":"application/json","Accept":"application/json"},"body":{"email":"taro@example.com","name":"Taro Yamada"},"omitted_optional_fields":["role"],"evidence":["POST /users"],"uncertainties":[]},"usage":{"input_tokens":0,"output_tokens":0}}}
```

Allowed `status` values are:

- `pass`: the reviewed response satisfies the task's expected outcome.
- `fail`: the reviewed response contradicts or omits required expected behavior.
- `inconclusive`: the response cannot be graded confidently.
- `blocked`: the run could not be completed due to provider, credential, quota, safety, or tooling constraints.

Rules:

- Do not commit API keys, request authorization headers, provider account identifiers, or full raw provider logs.
- Keep provider usage fields only when they are useful for token-load comparison and safe to publish.
- A run is not live evidence until it has a concrete `executed_at`, target ID, task ID, model, status, review notes, and captured response content or a blocking reason.
