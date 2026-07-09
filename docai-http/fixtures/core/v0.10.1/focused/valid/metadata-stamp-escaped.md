# valid: metadata stamp escaping

Expected: valid metadata stamp line. The escaped backslash and pipe values are decoded only after pair splitting.

```markdown
> docai-http: 0.10.1 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: core\\run\|001 | projection_id: core\\projection\|001 | source: specs\\public\|core.yaml (OpenAPI 3.1.1) | x-fixture: metadata-escaped
```
