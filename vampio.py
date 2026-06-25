"""
Vampio

v 1.0.0
"""
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import random
import string
import os
import uuid
import json
import re
from datetime import datetime

from writers import tabular, json_writer, xlsx

try:
    import rstr
except ImportError:
    rstr = None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COL_TYPES = [
    "String",
    "Int",
    "Float",
    "Boolean",
    "UUID",
    "DateTime",
    "RegEx",
    "Set/Enum",
    "Sequence",
    "Blob/Hex",
    "File",
    "Dependency",
    "File_Path",
    "Calculation",
]

RULE_PLACEHOLDER: dict[str, str] = {
    "String": "length  (e.g. 12)",
    "Int": "min,max  (e.g. 1,100)",
    "Float": "min,max  (e.g. 0.0,1.0)",
    "Boolean": "— no rule needed —",
    "UUID": "— no rule needed —",
    "DateTime": "strftime fmt  (e.g. %Y-%m-%d %H:%M:%S)",
    "RegEx": "pattern  (e.g. ^[A-Z]{3}[0-9]{5}$)",
    "Set/Enum": "mode:single, vals:'GET,POST,PUT'",
    "Sequence": "start:1000, step:1, fmt:SN-%05d",
    "Blob/Hex": "length:6, fmt:hyphen (or colon/none)",
    "File": "path:'data.txt', loop:true",
    "Dependency": 'if {status} == FAIL then RegEx:ERR-\\d{3} else ""',
    "File_Path": "root:'\\logs\\', ext:'.png', ts:true",
    "Calculation": "{Net_Weight} + {Tare_Weight}",
}

_SETTINGS_PATH = os.path.join(os.path.expanduser("~"), ".vampio_settings.json")


# ---------------------------------------------------------------------------
# Persistence & Parsing Helpers
# ---------------------------------------------------------------------------


def _load_settings() -> dict:
    try:
        with open(_SETTINGS_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def _save_settings(data: dict) -> None:
    try:
        with open(_SETTINGS_PATH, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
    except Exception:
        pass


def parse_kv_rules(rule_str: str) -> dict:
    """
    Safely parse key:value options from a rule string.
    Respects quotes so commas inside them aren't split.
    Ignores colons that are part of Windows file paths (e.g., C:\).
    """
    opts = {}
    parts = []
    current_part = []
    in_single = False
    in_double = False

    # 1. Safely split by comma respecting quotes
    for char in rule_str:
        if char == "'" and not in_double:
            in_single = not in_single
            current_part.append(char)
        elif char == '"' and not in_single:
            in_double = not in_double
            current_part.append(char)
        elif char == "," and not in_single and not in_double:
            parts.append("".join(current_part))
            current_part = []
        else:
            current_part.append(char)

    if current_part:
        parts.append("".join(current_part))

    # 2. Extract Key-Value pairs
    for part in parts:
        part = part.strip()
        if ":" in part:
            idx = part.find(":")
            key_candidate = part[:idx].strip().lower()

            # Prevent Windows drive letters (C:\) from being treated as keys
            if (
                len(key_candidate) == 1
                and len(part) > idx + 1
                and part[idx + 1] in ("\\", "/")
            ):
                continue

            val = part[idx + 1 :].strip()
            # Remove encapsulating quotes from the value natively
            if (val.startswith("'") and val.endswith("'")) or (
                val.startswith('"') and val.endswith('"')
            ):
                val = val[1:-1]

            opts[key_candidate] = val
    return opts


# ---------------------------------------------------------------------------
# Value generator
# ---------------------------------------------------------------------------


def generate_value(
    col_type: str,
    rule: str,
    row_context: dict = None,
    state: dict = None,
    col_name: str = "",
):
    if row_context is None:
        row_context = {}
    if state is None:
        state = {}

    try:
        if col_type == "String":
            k = int(rule) if rule.strip().isdigit() else 10
            return "".join(random.choices(string.ascii_letters + string.digits, k=k))

        elif col_type == "Int":
            if not rule.strip() or "min,max" in rule:
                rule = "1,100"
            lo, hi = rule.split(",", 1)
            return random.randint(int(lo), int(hi))

        elif col_type == "Float":
            if not rule.strip() or "min,max" in rule:
                rule = "0.0,1.0"
            lo, hi = rule.split(",", 1)
            return round(random.uniform(float(lo), float(hi)), 4)

        elif col_type == "Boolean":
            return random.choice((True, False))

        elif col_type == "UUID":
            return str(uuid.uuid4())

        elif col_type == "DateTime":
            fmt = rule.strip() or "%Y-%m-%d %H:%M:%S"
            return datetime.now().strftime(fmt)

        elif col_type == "RegEx":
            return rstr.xeger(rule) if rstr else "rstr_missing"

        elif col_type == "Set/Enum":
            opts = parse_kv_rules(rule)
            # Support both keyed `vals:'A,B,C'` and raw unkeyed `'A,B,C'` rules
            if "vals" in opts:
                vals_raw = opts["vals"]
                choices = [v.strip() for v in vals_raw.split(",")]
            else:
                choices = [v.strip() for v in rule.split(",")]

            mode = opts.get("mode", "single").lower()

            if not choices:
                return ""
            if mode == "multi":
                k = random.randint(1, len(choices))
                return ", ".join(random.sample(choices, k))
            return random.choice(choices)

        elif col_type == "Sequence":
            opts = parse_kv_rules(rule)
            start = int(opts.get("start", opts.get("start_at", 1)))
            step = int(opts.get("step", 1))
            fmt = opts.get("fmt", opts.get("format", "%d"))

            if "sequences" not in state:
                state["sequences"] = {}
            if col_name not in state["sequences"]:
                state["sequences"][col_name] = start
            else:
                state["sequences"][col_name] += step

            curr_val = state["sequences"][col_name]
            try:
                return fmt % curr_val
            except Exception:
                return f"{fmt}{curr_val}"

        elif col_type == "Blob/Hex":
            opts = parse_kv_rules(rule)
            length = int(opts.get("length", opts.get("len", 8)))
            fmt = opts.get("fmt", opts.get("format", "none")).lower()

            raw_bytes = bytes(random.getrandbits(8) for _ in range(length))
            if "hyphen" in fmt:
                sep = "-"
            elif "colon" in fmt:
                sep = ":"
            else:
                sep = ""

            hex_out = sep.join(f"{b:02x}" for b in raw_bytes)
            return (
                hex_out.upper()
                if (fmt in ("hyphen", "colon") or "upper" in fmt)
                else hex_out
            )

        elif col_type == "File":
            opts = parse_kv_rules(rule)
            raw_path = opts.get("path", opts.get("file_path", ""))

            if not raw_path:
                if rule.strip() and "loop:" not in rule.lower():
                    raw_path = rule.strip(" '\"")
                loop = True
            else:
                loop = str(opts.get("loop", "true")).lower() in ("true", "1", "yes")

            path = raw_path

            if "files" not in state:
                state["files"] = {}

            # Perform disk operations ONLY ONCE per state lifecycle
            if col_name not in state["files"]:
                lines = []
                err_msg = None

                if not path:
                    err_msg = "ERR: NO_PATH"
                elif not os.path.exists(path):
                    err_msg = f"ERR: NOT_FOUND ({os.path.basename(path)})"
                else:
                    try:
                        # Attempt standard UTF-8 read
                        with open(path, "r", encoding="utf-8") as f:
                            lines = [line.strip() for line in f if line.strip()]
                    except UnicodeDecodeError:
                        try:
                            # Fallback for older ANSI encoded text files
                            with open(path, "r", encoding="latin-1") as f:
                                lines = [line.strip() for line in f if line.strip()]
                        except Exception:
                            err_msg = "ERR: UNREADABLE_FILE"
                    except Exception:
                        err_msg = "ERR: UNREADABLE_FILE"

                state["files"][col_name] = {"lines": lines, "idx": 0, "err": err_msg}

            file_ctx = state["files"][col_name]

            # Surface specific errors gracefully into the cell
            if file_ctx.get("err"):
                return file_ctx["err"]
            if not file_ctx["lines"]:
                return "ERR: FILE_EMPTY"

            val = file_ctx["lines"][file_ctx["idx"]]
            file_ctx["idx"] += 1
            if file_ctx["idx"] >= len(file_ctx["lines"]):
                file_ctx["idx"] = 0 if loop else len(file_ctx["lines"]) - 1
            return val

        elif col_type == "Dependency":
            match = re.search(
                r"if\s+\{([^}]+)\}\s*==\s*['\"]?(.*?)['\"]?\s+then\s+(.*?)\s+else\s+(.*)",
                rule,
                re.IGNORECASE,
            )

            if match:
                dep_col, target_val, then_expr, else_expr = match.groups()
                actual_val = str(row_context.get(dep_col.strip(), ""))

                chosen_expr = (
                    then_expr.strip()
                    if actual_val == target_val.strip()
                    else else_expr.strip()
                )

                if (
                    chosen_expr.startswith(("'", '"'))
                    and chosen_expr.endswith(("'", '"'))
                    and len(chosen_expr) >= 2
                ):
                    chosen_expr = chosen_expr[1:-1]

                if ":" in chosen_expr:
                    act_type, act_rule = chosen_expr.split(":", 1)
                    act_type = act_type.strip()

                    if act_type in COL_TYPES:
                        return generate_value(
                            act_type, act_rule.strip(), row_context, state, col_name
                        )

                return chosen_expr

            return "PARSE_ERR"

        elif col_type == "File_Path":
            opts = parse_kv_rules(rule)
            root = opts.get("root_dir", opts.get("root", ".")).strip("'\"")
            ext = opts.get("extension", opts.get("ext", ".txt")).strip("'\"")
            inc_ts = opts.get("include_timestamp", opts.get("ts", "true")).lower() in (
                "true",
                "1",
                "yes",
            )

            filename = f"item_{random.randint(1000, 9999)}"
            if inc_ts:
                filename = f"cam1_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            return os.path.join(root, f"{filename}{ext}")

        elif col_type == "Calculation":
            expr = rule
            if not expr.strip():
                # Safe engine fallback to prevent crash when placeholder rule is left unedited
                expr = "{Net_Weight} + {Tare_Weight}"

            fields = re.findall(r"\{([^}]+)\}", expr)
            for field in fields:
                val = row_context.get(field, 0)
                if val == "":
                    val = 0
                expr = expr.replace(f"{{{field}}}", str(val))

            if all(c in "0123456789+-*/(). " for c in expr):
                return eval(expr)
            return "MATH_ERR"

    except Exception:
        return "ERR"


# ---------------------------------------------------------------------------
# Row builder
# ---------------------------------------------------------------------------

_SKIPPED = object()


def build_row(columns: list, state: dict) -> dict:
    _raw: dict = {}

    for col in columns:
        name = col["name"]
        condition = col.get("condition", "").strip()
        skip_pct = col.get("skip_pct", 0.0)

        if condition:
            parent = _raw.get(condition, _SKIPPED)
            if parent is _SKIPPED:
                _raw[name] = _SKIPPED
                continue

        if skip_pct and random.random() < skip_pct / 100.0:
            _raw[name] = _SKIPPED
            continue

        _raw[name] = generate_value(
            col["type"], col["rule"], row_context=_raw, state=state, col_name=name
        )

    return {k: ("" if v is _SKIPPED else v) for k, v in _raw.items()}


# ---------------------------------------------------------------------------
# Tooltip helper
# ---------------------------------------------------------------------------


class _Tooltip:
    def __init__(self, widget: tk.Widget, text: str):
        self._widget = widget
        self._text = text
        self._win: tk.Toplevel | None = None
        widget.bind("<Enter>", self._show)
        widget.bind("<Leave>", self._hide)

    def update_text(self, text: str):
        self._text = text
        if self._win:
            self._label.config(text=text)

    def _show(self, event=None):
        if self._win:
            return
        x = self._widget.winfo_rootx() + 20
        y = self._widget.winfo_rooty() + self._widget.winfo_height() + 4
        self._win = tk.Toplevel(self._widget)
        self._win.wm_overrideredirect(True)
        self._win.wm_geometry(f"+{x}+{y}")
        self._label = tk.Label(
            self._win,
            text=self._text,
            justify=tk.LEFT,
            background="#ffffe0",
            relief=tk.SOLID,
            borderwidth=1,
            font=("TkDefaultFont", 8),
            wraplength=320,
        )
        self._label.grid(row=0, column=0, sticky="nsew")
        self._win.grid_rowconfigure(0, weight=1)
        self._win.grid_columnconfigure(0, weight=1)

    def _hide(self, event=None):
        if self._win:
            self._win.destroy()
            self._win = None


# ---------------------------------------------------------------------------
# ColumnRow widget
# ---------------------------------------------------------------------------


class ColumnRow:
    _HINT_FG = "#aaaaaa"
    _ENTRY_FG: str | None = None

    def __init__(
        self,
        parent_frame: tk.Frame,
        all_rows: list,
        remove_cb,
        row_idx: int,
        name=None,
        col_type="String",
        rule="",
        skip_pct: float = 0.0,
        condition="",
    ):
        existing_names = [row.name for row in all_rows if hasattr(row, "name")]

        if name is None:
            counter = 1
            generated_name = f"new_column{counter}"
            while generated_name in existing_names:
                counter += 1
                generated_name = f"new_column{counter}"
            name = generated_name

        self.name = name
        self._all_rows = all_rows
        self._remove_cb = remove_cb

        if ColumnRow._ENTRY_FG is None:
            _tmp = tk.Entry(parent_frame)
            ColumnRow._ENTRY_FG = _tmp.cget("fg")
            _tmp.destroy()

        self.row_frame = tk.Frame(parent_frame, pady=2)
        self.row_frame.grid(row=row_idx, column=0, sticky="ew", padx=4)

        # 0. Name
        self.name_var = tk.StringVar(value=name)
        ttk.Entry(self.row_frame, textvariable=self.name_var, width=15).grid(
            row=0, column=0, padx=(0, 4), sticky="w"
        )

        # 1. Data type
        self.type_var = tk.StringVar(value=col_type)
        type_cb = ttk.Combobox(
            self.row_frame,
            textvariable=self.type_var,
            values=COL_TYPES,
            state="readonly",
            width=12,
        )
        type_cb.grid(row=0, column=1, padx=(0, 4), sticky="w")
        type_cb.bind("<<ComboboxSelected>>", self._on_type_change)

        # 2. Rule entry
        self._rule_frame = tk.Frame(self.row_frame)
        self._rule_frame.grid(row=0, column=2, padx=(0, 4), sticky="w")

        self.rule_var = tk.StringVar()
        self._rule_entry = tk.Entry(self._rule_frame, width=23, fg=self._HINT_FG)
        self._rule_entry.grid(row=0, column=0, sticky="w")
        self._rule_entry.bind("<FocusIn>", self._rule_focus_in)
        self._rule_entry.bind("<FocusOut>", self._rule_focus_out)

        self._rule_tip = _Tooltip(self._rule_entry, "")
        self._set_placeholder(col_type)
        if rule:
            self._rule_entry.config(fg=self._ENTRY_FG)
            self._rule_entry.delete(0, tk.END)
            self._rule_entry.insert(0, rule)

        self._browse_btn = ttk.Button(
            self._rule_frame, text="📁", width=3, command=self._browse_file
        )
        if col_type == "File":
            self._browse_btn.grid(row=0, column=1, padx=(2, 0))

        # 3. Skip probability
        skip_frame = tk.Frame(self.row_frame)
        skip_frame.grid(row=0, column=3, padx=(0, 4), sticky="w")

        self._skip_enabled = tk.BooleanVar(value=bool(skip_pct))
        skip_cb = ttk.Checkbutton(
            skip_frame,
            text="Skip%",
            variable=self._skip_enabled,
            command=self._on_skip_toggle,
        )
        skip_cb.grid(row=0, column=0, padx=(0, 1))

        self._skip_pct_var = tk.StringVar(value=str(int(skip_pct)) if skip_pct else "")
        self._skip_entry = ttk.Entry(
            skip_frame, textvariable=self._skip_pct_var, width=4
        )
        self._skip_entry.grid(row=0, column=1, padx=(0, 1))
        ttk.Label(skip_frame, text="%").grid(row=0, column=2, padx=(0, 1))
        self._on_skip_toggle()

        # 4. Condition dropdown
        cond_frame = tk.Frame(self.row_frame)
        cond_frame.grid(row=0, column=4, padx=(0, 4), sticky="w")

        ttk.Label(cond_frame, text="If col:").grid(row=0, column=0, padx=(0, 1))
        self.condition_var = tk.StringVar(value=condition)
        self._cond_cb = ttk.Combobox(
            cond_frame, textvariable=self.condition_var, state="readonly", width=12
        )
        self._cond_cb.grid(row=0, column=1, padx=(0, 1))
        self._cond_cb.bind("<ButtonPress>", self._refresh_conditions)

        # 5. Delete button
        ttk.Button(
            self.row_frame, text="✖", command=lambda: self._remove_cb(self), width=3
        ).grid(row=0, column=5, sticky="w")

    def _set_placeholder(self, col_type: str):
        hint = RULE_PLACEHOLDER.get(col_type, "")
        self._placeholder = hint
        self._rule_tip.update_text(hint)
        if not self._rule_entry.get() or self._rule_entry.get() == getattr(
            self, "_placeholder_showing", ""
        ):
            self._rule_entry.config(fg=self._HINT_FG)
            self._rule_entry.delete(0, tk.END)
            self._rule_entry.insert(0, hint)
            self._placeholder_showing = hint

    def _rule_focus_in(self, _event=None):
        if self._rule_entry.get() == self._placeholder:
            self._rule_entry.config(fg=self._ENTRY_FG)
            self._rule_entry.delete(0, tk.END)

    def _rule_focus_out(self, _event=None):
        if not self._rule_entry.get().strip():
            self._rule_entry.config(fg=self._HINT_FG)
            self._rule_entry.insert(0, self._placeholder)
            self._placeholder_showing = self._placeholder

    def _on_type_change(self, _event=None):
        col_type = self.type_var.get()
        if col_type == "File":
            self._browse_btn.grid(row=0, column=1, padx=(2, 0))
        else:
            self._browse_btn.grid_remove()

        self._rule_entry.config(fg=self._HINT_FG)
        self._rule_entry.delete(0, tk.END)
        self._placeholder = RULE_PLACEHOLDER.get(col_type, "")
        self._rule_entry.insert(0, self._placeholder)
        self._placeholder_showing = self._placeholder
        self._rule_tip.update_text(self._placeholder)

    def _browse_file(self):
        filepath = filedialog.askopenfilename(title="Select File for Ingestion")
        if filepath:
            current_rule = self._rule_entry.get()
            loop_val = "true"

            # Persist existing loop setting if present
            if (
                current_rule
                and current_rule != self._placeholder
                and "loop:" in current_rule
            ):
                opts = parse_kv_rules(current_rule)
                loop_val = opts.get("loop", "true")

            # Format using exact quotes mapped by our upgraded string parser
            new_rule = f"path:'{filepath}', loop:{loop_val}"

            self._rule_entry.config(fg=self._ENTRY_FG)
            self._rule_entry.delete(0, tk.END)
            self._rule_entry.insert(0, new_rule)
            self._placeholder_showing = ""

    def _on_skip_toggle(self):
        state = tk.NORMAL if self._skip_enabled.get() else tk.DISABLED
        self._skip_entry.config(state=state)

    def _refresh_conditions(self, _event=None):
        my_name = self.name_var.get()
        choices = [""] + [
            r.name_var.get() for r in self._all_rows if r.name_var.get() != my_name
        ]
        self._cond_cb["values"] = choices

    def get_rule(self) -> str:
        val = self._rule_entry.get()
        return "" if val == self._placeholder else val

    def effective_skip_pct(self) -> float:
        if not self._skip_enabled.get():
            return 0.0
        raw = self._skip_pct_var.get().strip()
        if not raw:
            return 50.0
        try:
            return max(0.0, min(100.0, float(raw)))
        except ValueError:
            return 50.0

    def to_spec(self) -> dict:
        return {
            "name": self.name_var.get(),
            "type": self.type_var.get(),
            "rule": self.get_rule(),
            "skip_pct": self.effective_skip_pct(),
            "condition": self.condition_var.get(),
        }

    def destroy(self):
        self.row_frame.destroy()


# ---------------------------------------------------------------------------
# Main application
# ---------------------------------------------------------------------------


class VampioApp(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("Vampio — Synthetic Data Generator Suite")
        self.geometry("1100x740")
        self.minsize(950, 620)

        self.column_rows: list[ColumnRow] = []
        self.current_row_idx = 0
        self.is_running = False
        self.continuous_state = {}
        self._settings = _load_settings()

        self._setup_ui()
        self._auto_load_profile()

    def _setup_ui(self):
        self.grid_rowconfigure(1, weight=1)
        self.grid_rowconfigure(2, weight=1)
        self.grid_columnconfigure(0, weight=1)

        # --- 1. Top Setup Frame ---
        top = ttk.LabelFrame(self, text="Generation & Output")
        top.grid(row=0, column=0, sticky="ew", padx=10, pady=(8, 3))
        top.columnconfigure(0, weight=1)

        # Sub-Row 0: Generation Controls
        row0 = tk.Frame(top)
        row0.grid(row=0, column=0, sticky="ew", padx=5, pady=2)

        ttk.Label(row0, text="Mode:").grid(
            row=0, column=0, padx=(4, 2), pady=5, sticky="w"
        )
        self.mode_var = tk.StringVar(value="Batch")
        ttk.Combobox(
            row0,
            textvariable=self.mode_var,
            values=["Batch", "Continuous"],
            state="readonly",
            width=10,
        ).grid(row=0, column=1, padx=(0, 15), pady=5, sticky="w")

        ttk.Label(row0, text="Rows (Batch) / Interval ms (Continuous):").grid(
            row=0, column=2, padx=(0, 2), pady=5, sticky="w"
        )
        self.count_var = tk.IntVar(value=500)
        ttk.Entry(row0, textvariable=self.count_var, width=8).grid(
            row=0, column=3, padx=(0, 15), pady=5, sticky="w"
        )

        ttk.Label(row0, text="Format:").grid(
            row=0, column=4, padx=(0, 2), pady=5, sticky="w"
        )
        self.fmt_var = tk.StringVar(value="csv")
        ttk.Combobox(
            row0,
            textvariable=self.fmt_var,
            values=["csv", "txt", "json", "jsonl", "xlsx"],
            state="readonly",
            width=7,
        ).grid(row=0, column=5, padx=(0, 5), pady=5, sticky="w")

        # Sub-Row 1: File Output Configurations
        row1 = tk.Frame(top)
        row1.grid(row=1, column=0, sticky="ew", padx=5, pady=2)
        row1.columnconfigure(3, weight=1)  # Expand directory label seamlessly

        ttk.Label(row1, text="File name:").grid(
            row=0, column=0, padx=(4, 2), pady=(2, 6), sticky="w"
        )
        self.filename_var = tk.StringVar(value="vampio_suite_data")
        ttk.Entry(row1, textvariable=self.filename_var, width=22).grid(
            row=0, column=1, padx=(0, 15), pady=(2, 6), sticky="w"
        )

        self.ts_enabled_var = tk.BooleanVar(value=True)
        self.include_timestamp = ttk.Checkbutton(
            row1,
            text="Include timestamp",
            variable=self.ts_enabled_var,
        )
        self.include_timestamp.grid(row=0, column=2, padx=(4, 2), pady=(2, 6), sticky="e")

        ttk.Label(row1, text="Output dir:").grid(
            row=0, column=3, padx=(4, 2), pady=(2, 6), sticky="e"
        )
        self.output_dir = tk.StringVar(value=os.getcwd())

        ttk.Label(
            row1, textvariable=self.output_dir, foreground="gray", anchor="e"
        ).grid(row=0, column=4, padx=(0, 6), pady=(2, 6), sticky="e")
        ttk.Button(row1, text="📁 Browse…", command=self._select_dir, width=11).grid(
            row=0, column=5, padx=(0, 4), pady=(2, 6), sticky="e"
        )

        # --- 2. Columns Setup Wrapper ---
        col_wrapper = ttk.LabelFrame(self, text="Column Configuration")
        col_wrapper.grid(row=1, column=0, sticky="nsew", padx=10, pady=3)
        col_wrapper.grid_rowconfigure(2, weight=1)
        col_wrapper.grid_columnconfigure(0, weight=1)

        btn_bar = tk.Frame(col_wrapper)
        btn_bar.grid(row=0, column=0, columnspan=2, sticky="ew", padx=4, pady=(4, 2))

        ttk.Button(btn_bar, text="＋ Add Column", command=self._add_column).grid(
            row=0, column=0, padx=(0, 4)
        )
        ttk.Button(
            btn_bar, text="🚫 Clear All", command=self._confirm_clear_columns
        ).grid(row=0, column=1, padx=(0, 4))
        ttk.Separator(btn_bar, orient="vertical").grid(
            row=0, column=2, sticky="ns", padx=6, pady=2
        )
        ttk.Button(btn_bar, text="💾 Save Profile", command=self._save_profile).grid(
            row=0, column=3, padx=(0, 4)
        )
        ttk.Button(btn_bar, text="📂 Load Profile", command=self._load_profile).grid(
            row=0, column=4, padx=(0, 4)
        )
        ttk.Button(btn_bar, text="📥 Load Demo Suite", command=self._load_demo).grid(
            row=0, column=5, padx=(0, 4)
        )

        hdr = tk.Frame(col_wrapper, bg="#ececec")
        hdr.grid(row=1, column=0, columnspan=2, sticky="ew", padx=4, pady=(0, 1))

        header_configs = [
            ("Column Name", 15),
            ("Type", 13),
            ("Rule / Format Configuration", 28),
            ("Skip%", 13),
            ("If col:", 17),
            ("", 4),
        ]
        for i, (text, w) in enumerate(header_configs):
            tk.Label(
                hdr,
                text=text,
                bg="#ececec",
                font=("TkDefaultFont", 8, "bold"),
                width=w,
                anchor="w",
            ).grid(row=0, column=i, padx=(0, 4), sticky="w")

        canvas = tk.Canvas(col_wrapper, highlightthickness=0)
        vsb = ttk.Scrollbar(col_wrapper, orient="vertical", command=canvas.yview)
        self.col_container = tk.Frame(canvas)
        self.col_container.bind(
            "<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas.create_window((0, 0), window=self.col_container, anchor="nw")
        canvas.configure(yscrollcommand=vsb.set)

        canvas.grid(row=2, column=0, sticky="nsew", padx=(4, 0))
        vsb.grid(row=2, column=1, sticky="ns", pady=2)

        canvas.bind_all(
            "<MouseWheel>",
            lambda e: (
                canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")
                if str(e.widget).startswith(str(canvas))
                else None
            ),
        )

        # --- 3. Watch Live Preview ---
        watch = ttk.LabelFrame(self, text="Live Data Preview")
        watch.grid(row=2, column=0, sticky="nsew", padx=10, pady=3)
        watch.grid_rowconfigure(0, weight=1)
        watch.grid_columnconfigure(0, weight=1)

        self.tree = ttk.Treeview(watch, show="headings", height=7)
        sy = ttk.Scrollbar(watch, orient="vertical", command=self.tree.yview)
        sx = ttk.Scrollbar(watch, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=sy.set, xscrollcommand=sx.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        sy.grid(row=0, column=1, sticky="ns")
        sx.grid(row=1, column=0, sticky="ew")

        # --- 4. Execution Bottom Bar ---
        exec_bar = tk.Frame(self)
        exec_bar.grid(row=3, column=0, sticky="ew", padx=10, pady=(3, 8))
        self.btn_start = ttk.Button(
            exec_bar, text="▶  Start", command=self._start, width=10
        )
        self.btn_start.grid(row=0, column=0, padx=(0, 4))
        self.btn_stop = ttk.Button(
            exec_bar, text="⭕  Stop", command=self._stop, state=tk.DISABLED, width=10
        )
        self.btn_stop.grid(row=0, column=1, padx=(0, 8))
        self.status_var = tk.StringVar(value="Ready.")
        ttk.Label(exec_bar, textvariable=self.status_var, foreground="#444").grid(
            row=0, column=2, sticky="w"
        )

    def _auto_load_profile(self):
        last = self._settings.get("last_profile_path", "")
        if last and os.path.isfile(last):
            self._apply_profile_file(last, silent=True)
            self.status_var.set(f"Auto-loaded profile: {os.path.basename(last)}")
        else:
            self._load_demo()

    def _add_column(self, **kwargs):
        cr = ColumnRow(
            self.col_container,
            self.column_rows,
            remove_cb=self._remove_column,
            row_idx=self.current_row_idx,
            **kwargs,
        )
        self.current_row_idx += 1
        self.column_rows.append(cr)

    def _remove_column(self, col_row: ColumnRow):
        col_row.destroy()
        self.column_rows.remove(col_row)

    def _confirm_clear_columns(self):
        if not self.column_rows:
            return
        if messagebox.askyesno(
            "Clear all?", "Remove all columns?", default=messagebox.NO
        ):
            for cr in list(self.column_rows):
                self._remove_column(cr)

    def _load_demo(self):
        for cr in list(self.column_rows):
            self._remove_column(cr)

        self._add_column(
            name="Serial_Num",
            col_type="Sequence",
            rule="start:1000, step:1, fmt:SN-%05d",
        )
        self._add_column(
            name="HTTP_Method",
            col_type="Set/Enum",
            rule="mode:single, vals:'GET,POST,PUT,DELETE'",
        )
        self._add_column(
            name="MAC_Address", col_type="Blob/Hex", rule="length:6, fmt:hyphen"
        )
        self._add_column(name="Net_Weight", col_type="Float", rule="10.0,45.0")
        self._add_column(name="Tare_Weight", col_type="Float", rule="1.5,4.0")
        self._add_column(
            name="Total_Weight",
            col_type="Calculation",
            rule="{Net_Weight} + {Tare_Weight}",
        )
        self._add_column(
            name="Status", col_type="Set/Enum", rule="mode:single, vals:'PASS,FAIL'"
        )
        self._add_column(
            name="Log_Payload",
            col_type="Dependency",
            rule='if {Status} == FAIL then RegEx:^[A-Z]{3}-\\d{5}$ else ""',
        )
        self._add_column(
            name="Export_Path",
            col_type="File_Path",
            rule="root:'\\factory-nas\\logs\\', ext:'.png', ts:true",
        )

    def _save_profile(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("Vampio Profile", "*.json")],
            initialfile="vampio_profile.json",
        )
        if not path:
            return
        try:
            data = [cr.to_spec() for cr in self.column_rows]
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(data, fh, indent=4)
            self._settings["last_profile_path"] = path
            _save_settings(self._settings)
            messagebox.showinfo("Saved", f"Profile saved:\n{path}")
        except Exception as exc:
            messagebox.showerror("Save Error", str(exc))

    def _load_profile(self):
        path = filedialog.askopenfilename(filetypes=[("Vampio Profile", "*.json")])
        if path:
            self._apply_profile_file(path, silent=False)

    def _apply_profile_file(self, path: str, silent: bool = False):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            for cr in list(self.column_rows):
                self._remove_column(cr)
            for spec in data:
                self._add_column(
                    name=spec.get("name", "Col"),
                    col_type=spec.get("type", "String"),
                    rule=spec.get("rule", ""),
                    skip_pct=float(spec.get("skip_pct", 0.0)),
                    condition=spec.get("condition", ""),
                )
            self._settings["last_profile_path"] = path
            _save_settings(self._settings)
            if not silent:
                messagebox.showinfo("Loaded", f"Profile loaded:\n{path}")
        except Exception as exc:
            if not silent:
                messagebox.showerror("Load Error", str(exc))

    def _select_dir(self):
        d = filedialog.askdirectory()
        if d:
            self.output_dir.set(d)

    def _get_filepath(self) -> str:
            fmt = self.fmt_var.get()
            base = self.filename_var.get().strip() or "vampio_data"
            
            if self.ts_enabled_var.get():
                timestamp = f"_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            else:
                timestamp = ""
                
            return os.path.join(
                self.output_dir.get(),
                f"{base}{timestamp}.{fmt}",
            )

    def _collect_specs(self) -> list[dict]:
        return [cr.to_spec() for cr in self.column_rows]

    def _reset_tree(self, col_names: list):
        self.tree.delete(*self.tree.get_children())
        self.tree["columns"] = col_names
        for c in col_names:
            self.tree.heading(c, text=c)
            self.tree.column(c, width=110, anchor=tk.CENTER, minwidth=60)

    def _append_tree_rows(self, col_names: list, rows: list):
        for row in rows:
            self.tree.insert("", tk.END, values=[row.get(c, "") for c in col_names])
        children = self.tree.get_children()
        excess = len(children) - 200
        if excess > 0:
            self.tree.delete(*children[:excess])
        self.tree.yview_moveto(1)

    def _start(self):
        specs = self._collect_specs()
        if not specs:
            messagebox.showwarning("No Columns", "Add columns before generating.")
            return

        names = {s["name"] for s in specs}
        for s in specs:
            ref = s.get("condition", "")
            if ref and ref not in names:
                messagebox.showerror(
                    "Invalid Condition",
                    f"Column '{s['name']}' references unknown column '{ref}'.",
                )
                return

        self._col_names = [s["name"] for s in specs]
        self._specs = specs
        self._reset_tree(self._col_names)
        self.filepath = self._get_filepath()
        self.fmt = self.fmt_var.get()

        if self.mode_var.get() == "Batch":
            self._run_batch()
        else:
            self.is_running = True
            self.btn_start.config(state=tk.DISABLED)
            self.btn_stop.config(state=tk.NORMAL)
            self.continuous_state = {}
            self._init_continuous()
            self._run_continuous()

    def _stop(self):
        self.is_running = False
        self.btn_start.config(state=tk.NORMAL)
        self.btn_stop.config(state=tk.DISABLED)
        self.status_var.set(f"Stopped. File: {os.path.basename(self.filepath)}")

    def _run_batch(self):
        n = self.count_var.get()
        self.status_var.set(f"Generating {n:,} rows…")
        self.update_idletasks()

        batch_state = {}
        rows = [build_row(self._specs, batch_state) for _ in range(n)]

        try:
            if self.fmt in ("csv", "txt"):
                tabular.write_batch(
                    self.filepath, self._col_names, rows, is_csv=(self.fmt == "csv")
                )
            elif self.fmt in ("json", "jsonl"):
                json_writer.write_batch(self.filepath, self._col_names, rows)
            elif self.fmt == "xlsx":
                xlsx.write_batch(self.filepath, self._col_names, rows)
        except Exception as exc:
            messagebox.showerror("Write Error", str(exc))
            self.status_var.set("Error writing file.")
            return

        self._append_tree_rows(self._col_names, rows)
        self.status_var.set(f"Done — {n:,} rows → {os.path.basename(self.filepath)}")

    def _init_continuous(self):
        try:
            if self.fmt in ("csv", "txt"):
                tabular.initialize_continuous(
                    self.filepath, self._col_names, is_csv=(self.fmt == "csv")
                )
            elif self.fmt in ("json", "jsonl"):
                json_writer.initialize_continuous(self.filepath, self._col_names)
            elif self.fmt == "xlsx":
                xlsx.initialize_continuous(self.filepath, self._col_names)
        except Exception as exc:
            self._stop()
            messagebox.showerror("Init Error", str(exc))

    def _run_continuous(self):
        if not self.is_running:
            return
        row = build_row(self._specs, self.continuous_state)

        try:
            if self.fmt in ("csv", "txt"):
                tabular.append_continuous(
                    self.filepath, self._col_names, row, is_csv=(self.fmt == "csv")
                )
            elif self.fmt in ("json", "jsonl"):
                json_writer.append_continuous(self.filepath, self._col_names, row)
            elif self.fmt == "xlsx":
                xlsx.append_continuous(self.filepath, self._col_names, row)
        except Exception as exc:
            self._stop()
            messagebox.showerror("Stream Error", str(exc))
            return

        self._append_tree_rows(self._col_names, [row])
        self.status_var.set(f"Streaming → {os.path.basename(self.filepath)}")
        self.after(self.count_var.get(), self._run_continuous)


if __name__ == "__main__":
    app = VampioApp()
    app.mainloop()
