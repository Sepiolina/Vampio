# Visual Analytics & Distribution Panel

The **Visual Analytics & Distribution Panel** provides real-time D3-powered statistical charts and data quality feedback directly above the reactive preview table. It is specifically engineered to handle continuous streaming and large synthetic datasets without freezing the browser or collapsing into microscopic, illegible lines.

---

## ⚡ Streaming Protection & Smart Windowing

### The Problem with Unconstrained Streaming
When generating synthetic data continuously or in large batches (e.g. 500 to 10,000+ rows):
- Rendering an SVG rect or point for every single row creates thousands of DOM nodes.
- When bounded to a container height, each row squishes into sub-pixel slivers (`< 0.1px`), destroying legibility and overloading the browser's render tree.

### The VAMPIO Solution
VAMPIO resolves this through **Buffer Windowing & Downsampling**:
- **Sampling Window Controls**: Switch between **Last 30 rows**, **Last 60 rows**, **Last 100 rows**, or **All (Binned)**.
- **Fixed Bounded Container**: Fixed height (`230px–260px`) prevents layout thrashing and UI jittering.
- **Animation Frame Throttling**: Updates during streaming are debounced using `requestAnimationFrame`, sustaining a smooth 60 FPS frame rate.
- **Live Stream Badge**: Displays an active glowing pulse indicator when continuous streaming is engaged.

---

## 📊 Supported Visualization Modes

### 1. 🔥 Density Matrix Heatmap
- Displays a 2D matrix of **Fields (X-Axis)** × **Rows (Y-Axis)**.
- Cell colors transition smoothly from the active theme's background to its accent color using HSL interpolation.
- **Null Visibility**: Cells containing `null` or missing values are rendered with a distinct dashed amber border and muted fill, making data omissions instantly visible.
- **Interactive Inspection**: Hovering over any cell reveals row number, column name, formatted value, and data type.

### 2. 📊 Frequency Distribution (Bar Graph)
- **Field Selector**: Analyze categorical (`Set/Enum`, `String`, `Boolean`) or binned numeric values for any field in the schema.
- **Top Frequencies**: Shows the top 10 unique values sorted by occurrence count.
- **Metrics**: Displays exact count labels above each bar and percentage share in hover tooltips.
- **Grid Guides**: Theme-harmonized horizontal guidelines and monospace category labels.

### 3. 📈 Sequential Trend & Drift (Line Graph)
- **Field Selector**: Plot numeric, sequence, float, or temporal fields.
- **Sequence Drift**: Analyzes whether values maintain stable bounds, drift over time, or oscillate as rows are generated.
- **Gradient Fill**: Smooth cubic monotone curve with subtle theme accent gradient fill underneath.
- **Statistical Markers**: Green dashed horizontal reference line for the **Mean (Average)** value.
- **Data Points**: Capped interactive hover dots providing exact values and mean deviation.

### 4. 🥧 Categorical Proportions (Donut / Pie Chart)
- **Proportional Slices**: D3 arc generator illustrating the distribution of categories or boolean outcomes (`true` vs `false`).
- **Interactive Arcs**: Slices expand smoothly on hover with count and percentage callouts.
- **Center Stat**: Displays total active sample rows in the center hole.
- **Legend**: Color-coded side legend with category labels and percentages.

### 5. 🩺 Column Health & Quality Matrix
- A fast bento-grid card view evaluating all schema columns simultaneously:
  - **Fill Rate**: Visual progress bar indicating percentage of populated vs. null cells (highlighted in amber if below 80%).
  - **Distinct Count**: Total unique values in the current sample buffer.
  - **Numeric Range**: Min, Max, and Average calculations for numerical fields.
