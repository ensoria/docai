# invalid: field_defaults Meaning on Constraints / Meaning table

Expected: invalid compact candidate. `Meaning=none` applies only to tables whose column is exactly `Meaning`, not `Constraints / Meaning`.

````markdown
> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: compact-candidate-compact-20260709-001 | projection_id: compact-candidate-20260709-001 | source: fixtures/compact-candidate-openapi.yaml (OpenAPI 3.1.1)

#### Query Parameters

**field_defaults**: Required=no | Meaning=none

| Name | Type |
|---|---|
| include | string |
````
