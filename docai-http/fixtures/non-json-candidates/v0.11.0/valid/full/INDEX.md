> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: non-json-candidate-full-20260710-001 | projection_id: non-json-candidate-20260710-001 | source: fixtures/non-json-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-non-json-candidate-001 | x-fixture: non-json-candidate

# API Index

## Endpoints

### resources/binary.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| PUT | /avatars/{id}/image | upload avatar | Uploads raw PNG bytes for an avatar image. | none |
| GET | /avatars/{id}/image | download avatar | Downloads raw PNG bytes with filename, size, and digest metadata. | none |

### resources/csv.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| GET | /reports/export | export reports | Downloads a UTF-8 CSV report export with fixed column order. | none |

### resources/forms.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /reports/search | search reports | Searches reports using a UTF-8 form-urlencoded request. | none |

### resources/uploads.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /documents | upload document | Uploads a document file with optional JSON metadata. | none |

## Workflows

none

## Webhooks

none
