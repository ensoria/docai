# valid: conventions whole-section unknown and unsupported

Expected: valid complete conformance. A whole `CONVENTIONS.md` heading may use the whole-section `unknown` form, or replacement `unsupported` with the canonical `CONVENTIONS <heading>` unit.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: requires-source | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

# API Conventions

## Rate Limits

unknown

**unknown**: rate-limit policy is not documented; requires platform-owner input

## Webhook Delivery

**unsupported**: replaces CONVENTIONS Webhook Delivery: delivery policy depends on runtime receiver capability negotiation at fixtures/conformance/v1.0.0/source/complete-openapi.yaml#/x-docai-webhook-delivery
````
