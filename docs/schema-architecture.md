# Schema Architecture & Data Types

VAMPIO provides 12 primitive and advanced data generation types designed to simulate complex real-world data patterns, constraints, and relational integrity.

---

## 📋 Supported Column Types & Rules

### 1. `String`
Generates random string values based on length or word presets.
- **Rule Syntax**:
  - `length`: Specific integer length (e.g. `12` or `32`).
  - `words:min:max`: Word count ranges for lorem/sentence text (e.g. `words:3:8`).
  - `casing`: `upper`, `lower`, or `title`.

### 2. `Int` (Integer)
Generates discrete numerical values with distribution controls.
- **Rule Syntax**: `min: <min>, max: <max>, step: <step>, dist: <uniform|normal|exponential>`
- **Example**: `min: 18, max: 80, dist: normal`
- **Distributions**:
  - `uniform`: Flat random distribution.
  - `normal`: Bell curve centered at `(min + max) / 2` with standard deviation `(max - min) / 6`.
  - `exponential`: Skewed distribution toward the minimum value.

### 3. `Float` (Floating Point)
Generates continuous decimal numbers with custom precision.
- **Rule Syntax**: `min: <min>, max: <max>, decimals: <precision>, dist: <uniform|normal|exponential>`
- **Example**: `min: 9.99, max: 999.99, decimals: 2`

### 4. `Boolean`
Generates boolean true/false values with probability weighting.
- **Rule Syntax**: `prob: <true_probability_0_to_1>`
- **Example**: `prob: 0.85` (85% probability of generating `true`, 15% `false`).

### 5. `UUID`
Generates standardized universally unique identifiers.
- **Rule Syntax**: `v4` (standard RFC4122 version 4) or `v1` (timestamp-based pseudo-UUID).
- **Example**: `4a1b2c3d-e4f5-4a6b-8c7d-9e0f1a2b3c4d`.

### 6. `DateTime`
Generates ISO 8601 timestamps or formatted date strings within defined boundaries.
- **Rule Syntax**: `start: <ISO_date>, end: <ISO_date>, format: <iso|date|time|timestamp>`
- **Example**: `start: 2024-01-01T00:00:00Z, end: 2026-12-31T23:59:59Z, format: iso`

### 7. `RegEx` (Pattern-Based Strings)
Generates high-fidelity strings matching specific regular expression syntax, including character classes, quantifiers, and prefixes.
- **Supported Tokens**:
  - `\d`: Digit `[0-9]`
  - `\w`: Word character `[a-zA-Z0-9_]`
  - `\s`: Whitespace
  - `[A-Z]`: Uppercase letter ranges
  - `[a-z]`: Lowercase letter ranges
  - `[0-9]`: Custom numeric ranges
  - `{n}`: Fixed count repetition
  - `{min,max}`: Range repetition
  - Literal text and delimiters: `-`, `/`, `@`, `.`, `_`
- **Common Patterns**:
  - US Phone: `\(\d{3}\) \d{3}-\d{4}`
  - Order Code: `ORD-[A-Z]{3}-\d{6}`
  - Credit Card: `4\d{3}-\d{4}-\d{4}-\d{4}`
  - Postal Code: `\d{5}(-\d{4})?`

### 8. `Set/Enum` (Categorical Values)
Generates values chosen from a finite list of categories, optionally weighted.
- **Rule Syntax**: `val1, val2, val3` or `val1:weight, val2:weight`
- **Example (Uniform)**: `PENDING, PROCESSING, COMPLETED, CANCELLED`
- **Example (Weighted)**: `COMPLETED:70, PENDING:20, FAILED:10`

### 9. `Sequence`
Generates strictly incremental or decremental integers for primary keys or serial identifiers.
- **Rule Syntax**: `start: <number>, step: <increment>`
- **Example**: `start: 1000, step: 1`

### 10. `Entity` (Realistic Domain Profiles)
Generates contextual real-world mock data utilizing internal dictionary generators.
- **Sub-types**:
  - `name.full`: Full personal names ("Jane Doe")
  - `name.first`: First names ("Alex")
  - `name.last`: Surnames ("Smith")
  - `internet.email`: Corporate or personal email addresses ("alex.smith@example.com")
  - `internet.ip`: IPv4 addresses ("192.168.1.45")
  - `address.street`: Street addresses ("42 Elm St")
  - `address.city`: Cities ("Seattle")
  - `address.country`: Country names or ISO codes ("United States")
  - `company.name`: Corporate names ("Acme Corp")
  - `finance.currency`: ISO currency codes ("USD", "EUR", "GBP")

### 11. `Blob/Hex`
Generates binary hashes, base64 strings, or hexadecimal digests.
- **Rule Syntax**: `format: <hex|base64>, bytes: <number>`
- **Example**: `format: hex, bytes: 32` (generates 64-character SHA-256 style hex strings).

### 12. `Calculation` (Cross-Column Formulas)
Computes dynamic values by referencing other columns within the same row.
- **Syntax**: Use square brackets `[column_name]` to reference fields.
- **Supported Arithmetic**: `+`, `-`, `*`, `/`, `%`, `Math.round()`, `Math.floor()`, `Math.min()`, `Math.max()`.
- **Examples**:
  - Total Price: `[quantity] * [unit_price]`
  - Tax Calculation: `Math.round(([subtotal] * 0.0825) * 100) / 100`
  - Full Name: `[first_name] + " " + [last_name]`

---

## ⚙️ Universal Column Attributes

Every field in the schema supports the following universal controls:
- **`nullPercentage`**: Integer between `0` and `100`. Defines the chance that a generated cell will be `null` (`None`/`NULL`/`""`).
- **`isUnique`**: When enabled, the generator engine maintains an internal hash set during batch runs to guarantee that no duplicate values are generated.
- **Reordering**: Field order can be altered by drag-and-drop, which determines column positioning in exported CSV, JSON, and SQL files.
