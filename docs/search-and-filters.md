# Search & Tokenized Filters

VAMPIO features a reactive preview search engine equipped with tokenized query syntax, interactive chips, boolean logic, and cell context menu filters.

---

## 🔍 Tokenized Search Syntax

The preview search bar supports both free-text searches and structured field-level filters:

### 1. Simple Column Equality
Filter records where a specific column matches a value:
```text
status:COMPLETED
role:admin
country:US
```

### 2. Quoted Strings & Multi-Word Values
Wrap values containing spaces or punctuation in quotation marks:
```text
city:"New York"
product_name:"Deluxe Widget"
```

### 3. Numeric Comparison Operators
For numerical or float fields:
```text
price:>100
quantity:<=5
age:>=21
score:<50
```

### 4. Nullability Filters
Find records with missing or populated values:
```text
phone:null         # Rows where phone is null, empty, or undefined
phone:notnull      # Rows where phone is present
```

### 5. Negation (`!`)
Exclude specific values:
```text
!status:CANCELLED
!country:RU
```

### 6. AND / OR Multi-Token Logic
Combine multiple token conditions:
- **AND Logic (Default)**: Separate tokens with spaces.
  ```text
  status:COMPLETED amount:>500 country:US
  ```
- **Explicit OR Logic**: Insert `OR` between terms.
  ```text
  status:PENDING OR status:PROCESSING
  ```

---

## 🖱️ Cell Context Menu Filtering

You can construct filters directly from the live preview table without typing:

1. **Right-Click** on any cell in the **Preview Table**.
2. Choose from the context menu actions:
   - **Filter by this value**: Automatically adds `column:value` to the search bar.
   - **Exclude this value**: Adds `!column:value` to the search bar.
   - **Filter if Null / Not Null**: Rapidly isolates missing data points.
   - **Copy Cell Value**: Copies the raw value to the system clipboard.
3. The table immediately re-filters in real time.

---

## 🏷️ Interactive Filter Chips

Active filters appear as dismissible visual tokens above the data grid:
- Click the **×** button on any filter chip to remove that filter.
- Click **Clear All** to reset filters and view the complete generated dataset.
- Filter counts and matching record ratios update dynamically in the table status bar.
