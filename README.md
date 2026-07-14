# DocAI

DocAI is a family of documentation formats designed specifically for AI/LLM consumption. It helps language models understand interfaces efficiently and use them correctly during software development.

## Formats

- [DocAI HTTP](docai-http/README.md) — Documentation format for HTTP APIs

## Evidence Status

DocAI HTTP now has complete required-target evaluation records for the current `0.12.0` complete-candidate fixture: 15 / 15 live LLM task records passed across request construction, response handling, error handling, and workflow completion, plus 6 / 6 deterministic token-load records. In the same fixture, the compact profile reduced selected context by 748 characters for create-user and 588 characters for checkout versus the full DocAI profile.

OpenAPI comparison live baselines are now recorded for the same fixture, target models, and task contracts. In this scoped comparison, DocAI HTTP's selected full/compact contexts passed 15 / 15 live task records; raw OpenAPI passed 2 / 15; task-sliced OpenAPI passed 2 / 15; enriched OpenAPI with supplemental behavior prose passed 14 / 15. The comparison data and scope limits are tracked in [OpenAPI Comparison Evidence](docai-http/OPENAPI-COMPARISON-EVIDENCE.md).
