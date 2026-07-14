# valid: unrepresentable endpoint omitted

Expected: valid complete candidate. An operation whose method or path cannot be represented is not emitted as a compliant endpoint.

````source
GET /reports/{report id}
````

The template variable contains ASCII whitespace, so the source operation is not normalized into a DocAI HTTP endpoint.

````markdown
# API Index

## Endpoints

### resources/reports.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| GET | /reports/{id} | download report | Downloads a representable report endpoint. | none |

## Workflows

none

## Webhooks

none
````
