# Private Benchmark Workspace

Files beside this README are intentionally ignored by Git until all nine
primary benchmark batches close. This reduces public training-contamination
risk for the two holdout APIs and prevents partial results from being mistaken
for completed evidence.

Expected local layout:

```text
private/
  holdouts/
    field-service/
    media-processing/
  prompts/
  contexts/
  checkpoints/
  runs/
  adjudication/
```

Keep an access-controlled backup before Live execution. Do not place API keys,
provider account identifiers, billing balances, or unrelated secrets here.
After all batches close, review and redact the artifacts before deliberately
moving publishable evidence out of this ignored directory.
