# valid: behavior unknown marker

Expected: valid complete conformance. Missing authoritative behavior facts use `unknown` in the canonical Behavior key values and a following `**unknown**:` marker.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-002 | projection_id: conformance-20260721-rc2-002 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

## POST /users

Creates a user.

### Behavior

- side_effects: unknown
- idempotency: unknown
- preconditions: none
- authorization: `users:write` scope

**unknown**: side effects and idempotency are not documented; requires service-owner annotations for POST /users
````
