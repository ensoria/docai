# invalid: webhook INDEX missing Details

Expected: invalid complete candidate. The INDEX `Webhooks` table must include `Name`, `Summary`, and `Details`.

````markdown
# API Index

## Endpoints

none

## Workflows

none

## Webhooks

| Name | Summary |
|---|---|
| payment.completed | Sent when a payment settles. |
````
