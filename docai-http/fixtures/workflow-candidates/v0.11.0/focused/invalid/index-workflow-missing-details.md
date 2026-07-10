# invalid: workflow INDEX missing Details

Expected: invalid workflow candidate. The INDEX `Workflows` table must include `Name`, `Summary`, and `Details`.

```markdown
# API Index

## Endpoints

none

## Workflows

| Name | Summary |
|---|---|
| Checkout | Validates payment and creates an order. |

## Webhooks

none
```
