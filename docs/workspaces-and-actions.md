# Workspaces & Actions

## Workspaces

Each tab in the workspace bar is an independent workspace holding its own schema, output format and settings.

- **New tab** with the `+` button; the tab menu offers duplicate and preset options.
- **Quick switcher**: `Ctrl/Cmd+K` opens a searchable list of workspaces.
- **Save policy** (Settings → Workspaces & Projects): `auto`, `prompt` or `manual`. With `prompt`, Vampio asks before discarding unsaved changes.
- **Layout**: workspace tabs can be shown in the top bar or in a sidebar drawer.
- **Blueprints**: *Files → Export Blueprint (.json)* saves the current schema; *Import Blueprint* loads one.
- **Session history**: *Files → Restore Latest Session* reopens your last session.
- **Reset**: *Files → Reset to Blank Schema* clears the current workspace.

Workspace data is kept in local storage on your device.

![Settings menu](./screenshots/settings-menu.png)

## Output settings

Defaults live under **Settings → General**: default export format, batch output rows, and streaming throttle.

| Format | Extension |
| :--- | :--- |
| CSV / TSV | `.csv`, `.tsv` |
| JSON / JSON Lines | `.json`, `.jsonl` |
| SQL | `.sql` (`CREATE TABLE` plus batched `INSERT`) |
| XML / text | `.xml`, `.txt` |
| Excel | `.xlsx`, `.xls` |

**Destinations:** direct download, a local folder (streamed to disk), or a webhook action.

**Output strategies** (Generation Deck):

| Strategy | Behaviour |
| :--- | :--- |
| Single File | Writes one fresh output file. |
| Multi-File | Writes one file per row or per chunk of rows. |
| In-Place Append | Continues an existing file. |
| Smart Detect | Picks a strategy based on the target. |

![Generation deck](./screenshots/generation-deck.png)

## Webhook actions

Actions send generated rows to an HTTP endpoint while or after they are produced. They are **off by default**: enable them with the *Webhook Add-on* toggle in the right rail, then configure the endpoint.

| Setting | Options / default |
| :--- | :--- |
| Protocol | `rest_json`, `webhook_custom`, `graphql` |
| Method | `POST` by default |
| Mode | `per_entry` (every row) or `batch` (every N rows, default 50) |
| Batch payload key | `records` by default |
| Headers | Defaults to `Content-Type: application/json` and an `X-Source` header; add your own |
| Authentication | none, bearer, basic, API key |
| Retries | enabled, 3 attempts, 1000 ms delay |
| Timeout | 10 000 ms |
| Throttle | 50 ms between requests |
| Stop on error | off by default |
| Trigger condition | Only send rows where a chosen column matches a value (equals and other operators) |

Payloads can be shaped with the **Custom JSON Payload** template (Files menu). Every dispatch is recorded in the **Action Log** (history icon in the right rail), including retries.

> Webhook actions make network requests to the endpoint you configure. Use them only with endpoints you control or trust.
