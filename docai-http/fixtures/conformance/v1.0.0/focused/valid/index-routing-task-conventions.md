# valid: INDEX routing, task labels, and convention hints

Expected: valid complete conformance. INDEX uses fixed sections in order, multiple task labels use `; `, `Also read` uses comma-separated docs-root paths, and `Conventions` uses exact heading names, `all`, or `none`.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /users | create user; invite user | Creates a user and optionally sends an invitation email. | workflows/user-onboarding.md, webhooks/user-created.md | Authentication, Request Formats, Errors |
| GET | /health | health check | Checks public service availability without authentication. | none | none |
| GET | /reports/{id} | download report | Downloads a signed report and follows all API conventions. | none | all |

## Workflows

| Name | Summary | Details |
|---|---|---|
| User onboarding | Create and invite a user. | workflows/user-onboarding.md |

## Webhooks

| Name | Summary | Details |
|---|---|---|
| user.created | Sent when a user is created. | webhooks/user-created.md |
````
