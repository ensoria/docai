# DocAI

DocAI is a family of documentation formats designed specifically for AI/LLM consumption. It helps language models understand interfaces efficiently and use them correctly during software development.

## Project Status

DocAI remains a long-term project, but active development is currently a low priority. Work on DocAI HTTP and DocAI Messaging continues slowly as maintainer time allows. Development has not been discontinued, and the intent is to complete the remaining work, but there is no committed completion date or release schedule.

External contributions are not currently being solicited. Feedback, questions, and problem reports are welcome through [GitHub Issues](https://github.com/ensoria/docai/issues). Responses and follow-up work may take time. See [CONTRIBUTING.md](CONTRIBUTING.md) for the current participation policy.

## Formats

### [DocAI HTTP](docai-http/README.md)

DocAI HTTP is a documentation format for HTTP APIs. Its current tagged public release is `v1.0.0`, the first Stable contract, promoted from reviewed `v1.0.0-rc.4`, with its versioned conformance corpus at [`docai-http/fixtures/conformance/v1.0.0/`](docai-http/fixtures/conformance/v1.0.0/).

The Stable label applies to the HTTP specification's defined compatibility and conformance scope. Evidence for its practical effectiveness remains limited to the evaluated fixtures, tasks, and models described below; broader validation remains ongoing work.

The existing repository tag `v1.0.0` identifies the DocAI HTTP release only. It does not identify a release of DocAI Messaging or a shared version of the entire DocAI family. Future release tags use separate component prefixes: `docai-http/vX.Y.Z` and `docai-messaging/vX.Y.Z`.

### [DocAI Messaging](docai-messaging/README.md)

DocAI Messaging is a documentation format for message-driven APIs. It is currently an unfinished, pre-1.0 Draft specification at version `0.17.1`, versioned independently from DocAI HTTP.

Its publication label is **Compatibility Core implementation target**: only the defined Core rules and matching fixture scope are implementation targets. The full specification is not yet complete-generator-ready, compatibility-stable, or Stable. Advanced structures such as compact profiles, workflows, and non-JSON representations remain draft material outside that implementation target. See the [DocAI Messaging specification](docai-messaging/README.md) for the authoritative version, scope, and limitations.

## Evidence Status

DocAI HTTP has complete required-target evaluation records for the evaluated `0.12.0` complete-candidate fixture: 15 / 15 live LLM task records passed across request construction, response handling, error handling, and workflow completion, plus 6 / 6 deterministic token-load records. In the same fixture, the compact profile reduced selected context by 748 characters for create-user and 588 characters for checkout versus the full DocAI profile.

OpenAPI comparison live baselines are now recorded for the same fixture, target models, and task contracts. In this scoped comparison, DocAI HTTP's selected full/compact contexts passed 15 / 15 live task records; raw OpenAPI passed 2 / 15; task-sliced OpenAPI passed 2 / 15; enriched OpenAPI with supplemental behavior prose passed 14 / 15. The comparison data and scope limits are tracked in [OpenAPI Comparison Evidence](docai-http/OPENAPI-COMPARISON-EVIDENCE.md).
