# valid: INDEX routing, task labels, and convention hints

Expected: valid complete candidate. INDEX uses fixed sections in order, multiple task labels use `; `, `Also read` uses comma-separated docs-root paths, and `Conventions` uses exact heading names, `all`, or `none`.

````markdown
> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

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
