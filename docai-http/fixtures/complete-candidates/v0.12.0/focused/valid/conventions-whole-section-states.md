# valid: conventions whole-section unknown and unsupported

Expected: valid complete candidate. A whole `CONVENTIONS.md` heading may use the whole-section `unknown` form, or replacement `unsupported` with the canonical `CONVENTIONS <heading>` unit.

````markdown
> docai-http: 0.12.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# API Conventions

## Rate Limits

unknown

**unknown**: rate-limit policy is not documented; requires platform-owner input

## Webhook Delivery

**unsupported**: replaces CONVENTIONS Webhook Delivery: delivery policy depends on runtime receiver capability negotiation at fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml#/x-docai-webhook-delivery
````
