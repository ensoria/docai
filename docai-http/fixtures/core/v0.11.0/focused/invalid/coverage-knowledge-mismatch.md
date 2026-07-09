# invalid: coverage and knowledge mismatch

Expected: invalid. The stamp says `coverage: complete` and `knowledge: complete`, but the body contains both `unsupported` and `unknown` markers.

```markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: core-full-20260709-001 | projection_id: core-20260709-001 | source: fixtures/core-openapi.yaml (OpenAPI 3.1.1)

**unsupported**: localized: dynamic required behavior at fixtures/core-openapi.yaml#/x-dynamic

**unknown**: retry behavior is not documented; requires service-owner input
```
