# invalid: metadata stamp wrong key order

Expected: invalid. `source` appears before required standard keys that must precede it.

```markdown
> docai-http: 0.11.0 | profile: full | source: fixtures/core-openapi.yaml (OpenAPI 3.1.1) | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: core-full-20260709-001 | projection_id: core-20260709-001
```
