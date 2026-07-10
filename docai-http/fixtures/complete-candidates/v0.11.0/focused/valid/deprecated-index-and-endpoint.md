# valid: deprecated index and endpoint marker

Expected: valid complete candidate. A deprecated endpoint has `**deprecated**:` immediately after the endpoint heading and `(deprecated)` at the start of the matching INDEX summary.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# API Index

## Endpoints

### resources/legacy-users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| GET | /legacy-users | list users | (deprecated) Lists legacy users; use GET /users instead. | none | Authentication, Errors |

## GET /legacy-users

**deprecated**: use GET /users instead; this endpoint will stop receiving new fields.

Lists legacy users.
````
