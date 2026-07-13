# DocAI

DocAI is a family of documentation formats designed specifically for AI/LLM consumption. It helps language models understand interfaces efficiently and use them correctly during software development.

## Formats

- [DocAI HTTP](docai-http/README.md) — Documentation format for HTTP APIs

## Evidence Status

DocAI HTTP now has complete required-target evaluation records for the current complete-candidate fixture: 15 / 15 live LLM task records passed across request construction, response handling, error handling, and workflow completion, plus 6 / 6 deterministic token-load records. In the same fixture, the compact profile reduced selected context by 748 characters for create-user and 588 characters for checkout versus the full DocAI profile.

The OpenAPI comparison baseline is planned but not complete yet, so the project treats "DocAI HTTP is better than OpenAPI for LLM API tasks" as a claim to measure, not as a published benchmark result. The comparison plan and current data are tracked in [OpenAPI Comparison Evidence](docai-http/OPENAPI-COMPARISON-EVIDENCE.md).
