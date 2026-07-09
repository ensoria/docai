# invalid: metadata extension before standard keys are complete

Expected: invalid. Extension keys must follow all present standard stamp keys.

```markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | x-fixture: bad-order | knowledge: complete | generated: 2026-07-09 | generation_id: core-full-20260709-001 | projection_id: core-20260709-001 | source: fixtures/core-openapi.yaml (OpenAPI 3.1.1)
```
