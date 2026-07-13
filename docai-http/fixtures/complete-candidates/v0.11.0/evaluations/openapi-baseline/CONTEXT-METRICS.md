# OpenAPI Baseline Context Metrics

These deterministic local metrics describe the context supplied to OpenAPI comparison prompts. They are not provider tokenizer counts and are not live LLM results.

Recorded at: 2026-07-13T13:16:05.001Z

Source: `docai-http/fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml`

| Task | Group | Condition | UTF-8 bytes | Characters | Approx tokens(chars/4) |
|---|---|---|---:|---:|---:|
| request-create-user-compact | request_construction | raw | 5738 | 5738 | 1435 |
| request-upload-document-full | request_construction | raw | 5738 | 5738 | 1435 |
| response-payment-created-compact | response_handling | raw | 5738 | 5738 | 1435 |
| error-create-user-compact | error_handling | raw | 5738 | 5738 | 1435 |
| workflow-complete-checkout-compact | workflow_completion | raw | 5738 | 5738 | 1435 |
| request-create-user-compact | request_construction | sliced | 1445 | 1445 | 362 |
| request-upload-document-full | request_construction | sliced | 696 | 696 | 174 |
| response-payment-created-compact | response_handling | sliced | 2832 | 2832 | 708 |
| error-create-user-compact | error_handling | sliced | 1443 | 1443 | 361 |
| workflow-complete-checkout-compact | workflow_completion | sliced | 3608 | 3608 | 902 |
| request-create-user-compact | request_construction | enriched | 10417 | 10417 | 2605 |
| request-upload-document-full | request_construction | enriched | 8088 | 8088 | 2022 |
| response-payment-created-compact | response_handling | enriched | 14627 | 14627 | 3657 |
| error-create-user-compact | error_handling | enriched | 10415 | 10415 | 2604 |
| workflow-complete-checkout-compact | workflow_completion | enriched | 18424 | 18424 | 4606 |

Conditions:

- `raw`: the complete source OpenAPI YAML as authored.
- `sliced`: only the mapped OpenAPI paths, schemas, webhooks, and workflow extension blocks for the task.
- `enriched`: the sliced OpenAPI context plus selected authoritative Markdown behavior notes used as an enrichment proxy for source facts not expressed in raw OpenAPI.
