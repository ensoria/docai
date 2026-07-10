# invalid: structured parameter missing fields

Expected: invalid complete candidate. A represented object parameter must include complete structured-parameter fields.

````markdown
#### Query Parameters

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| filter | object | no | style=form, explode=true; encoded example `filter[name]=Taro&filter[role]=member`; additional properties forbidden |
````
