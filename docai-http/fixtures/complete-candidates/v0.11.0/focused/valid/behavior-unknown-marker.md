# valid: behavior unknown marker

Expected: valid complete candidate. Missing authoritative behavior facts use `unknown` in the canonical Behavior key values and a following `**unknown**:` marker.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

## POST /users

Creates a user.

### Behavior

- side_effects: unknown
- idempotency: unknown
- preconditions: none
- authorization: `users:write` scope

**unknown**: side effects and idempotency are not documented; requires service-owner annotations for POST /users
````
