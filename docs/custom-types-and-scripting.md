# Custom Types & Scripting

When the 12 built-in column types are not enough, you can define your own reusable types. Open **Others → Custom Column Type Studio**.

![Custom Column Type Studio](./screenshots/custom-type-studio.png)

## Studio tabs

| Tab | Use it to |
| :--- | :--- |
| **Examples** | Browse ready-made types (banking transaction codes with Luhn checksums, Thai national ID, SKU codes, IBAN, IPv6, REST-enriched profiles, and more). Each has a sample output, **Add to My Types** and **Use in Schema**. |
| **Import & Manage** | Import and export custom type definitions as JSON. |
| **Create Type** | Build a type from scratch. |
| **My Types** | Enable, disable, edit or remove types you have added. |

Custom types are stored locally in your browser or desktop app profile and appear in the column type dropdown.

## Writing a script

A script column is evaluated once per row. It can be written in **JavaScript** or **Lua 5.3** (run in-browser via Fengari).

A script may be a single expression or a full function body.

```js
// JavaScript: single expression
'INV-' + ctx.index

// JavaScript: function body with return
const tier = ctx.random.weighted([
  { value: 'free', weight: 70 },
  { value: 'pro', weight: 30 },
]);
return tier + '-' + utils.pad(ctx.index, 6, '0');
```

```lua
-- Lua: single expression
"INV-" .. ctx.index

-- Lua: statements
local n = ctx.random.int(1, 99)
return ctx.utils.pad(n, 4, "0")
```

In JavaScript, `ctx`, `api`, `http`, `row`, `index`, `random` and `utils` are all in scope. In Lua, use them through `ctx` (for example `ctx.random.int`).

## The `ctx` object

| Member | Description |
| :--- | :--- |
| `ctx.index` | 1-based row number. `ctx.rowIndex` is the 0-based value. |
| `ctx.row` | Values of the columns already generated for this row. |
| `ctx.random.int(min, max)` | Random integer. |
| `ctx.random.float(min, max, decimals?)` | Random float (default 2 decimals). |
| `ctx.random.choice(array)` | One random element. |
| `ctx.random.weighted([{value, weight}])` | Weighted pick. |
| `ctx.random.boolean(probTrue?)` | Random boolean. |
| `ctx.random.date(startYear?, endYear?)` | Random date string. |
| `ctx.random.uuid()`, `hex(len?)`, `alpha(len?, uppercaseOnly?)`, `numeric(len?)` | Random identifiers and strings. |
| `ctx.utils.pad(value, len, char?)` | Left-pad a value. |
| `ctx.utils.luhnChecksum(digits)` | Luhn check digit. |
| `ctx.utils.thaiIdChecksum(first12)` | Thai national ID check digit. |
| `ctx.utils.hash(str)`, `slugify(str)`, `clamp(v, min, max)` | Small helpers. |

Lua exposes the random, padding, checksum and hash helpers listed above plus `ctx.api`/`ctx.http`; check the examples in the Studio for the exact Lua call forms.

## Calling REST APIs from a script

| Helper | Description |
| :--- | :--- |
| `api.get(url, jsonPathOrOptions?)` | Synchronous GET. Options: `path`, `headers`, `sampleStrategy` (`sequential` or `random`), `fallback`. |
| `api.post(url, body?, options?)` | Synchronous POST. Options: `headers`, `path`, `fallback`. |
| `api.extract(data, path, strategy?)` | Pull a value out of already-fetched JSON. |
| `api.fetchAsync(url, options?)` | Async fetch (returns a Promise). |
| `http.get(url, pathOrHeaders?)`, `http.post(url, body?, headers?)` | Simpler wrappers. |

The dedicated **REST API** column type (`+ REST API` in the quick strip) offers the same enrichment without code, and shows latency statistics in a badge. Responses are cached, so repeated calls are cheap.

> **Network note:** REST columns and `api`/`http` helpers are the only way schema generation reaches the network. Leave them out and Vampio stays fully offline. Browser builds are subject to the target server's CORS rules.

## Testing

Use the sample output in the Studio (**Roll sample**) and the live preview to validate a script before generating large datasets.
