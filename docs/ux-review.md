# UX review and fixes

Reviewed the browser workflow through first launch, workspace navigation, preset selection, live preview, CSV generation, workspace search/creation, and theme switching.

| Finding | Impact | Change |
| --- | --- | --- |
| First-launch dialog exceeded phone viewport height without scrolling. | Heading, close control, and Continue action could be clipped. | Bound the dialog to the dynamic viewport, allow scrolling, and prevent its sections from shrinking. |
| Mobile header controls exceeded the available width. | Theme control could be pushed off-screen; icon-only navigation was difficult to discover. | Place labeled workspace tabs on a separate mobile row and allow horizontal tab scrolling at smaller widths. |
| Tabs used `role="tab"` without corresponding keyboard behavior. | Every tab was in the Tab sequence; arrow keys, Home, and End did not navigate. | Use one tab stop per group, arrow-key activation with wrapping, Home/End, and automatic scrolling to the focused tab. |
| Reviewed dialogs lacked accessible names and keyboard focus containment. | Keyboard users could reach controls behind the overlay or lose their position after closing. | Add named dialogs, initial focus, focus trapping, Escape dismissal, and focus restoration to mode selection, presets, and the workspace switcher. |
| Mode cards relied on pointer selection. | Keyboard users could not change the selection used by Continue. | Add native radio choices, keep direct launch buttons, and include the chosen mode in Continue's label. |
| Preset filtering produced a blank results area. | Users received no explanation or recovery action. | Add a no-results message and Clear filters action; improve wrapping and scrolling on phones. |
| Workspace search included untrimmed whitespace and delegated Enter from every control. | Search could miss a workspace; activating the Create button by keyboard could also run the input's Enter handler. | Trim the search, scope navigation keys to the input, expose combobox/listbox semantics, and keep highlighted results visible. |
| Motion preferences and consistent keyboard focus indicators were missing. | Motion-sensitive and keyboard users received less usable feedback. | Respect reduced-motion preferences in Motion and CSS; provide a shared focus-visible outline. |

## Validation

- `npm run lint`: passed.
- `npm test`: all 161 tests across 16 files passed.
- `npm run build`: passed; the existing large-bundle warning remains.
- Chromium checks: onboarding scroll and focus trap; headers and keyboard tabs at 320×568, 390×844, 640×700, 768×1024, and 1440×1000; preset filtering and recovery; Escape/focus restoration; workspace search and single keyboard creation; light-theme switching.
- Functional browser check: load E-Commerce Orders, inspect its live preview, generate and download a CSV, and verify 1,000 records with the expected columns and email values.
- No browser runtime errors occurred in the checked flows.

## Repeating browser checks

The smoke script requires Python's `playwright` package and an installed Chromium executable. It uses a disposable browser profile and does not alter an existing user's workspace or settings. The browser is launched without its sandbox for compatibility with container environments; use it only with a trusted local application.

With the development server running, execute:

```bash
python scripts/check-ux.py
```

Use `CHROMIUM_PATH` to override `/usr/bin/chromium`, and `VAMPIO_TEST_URL` to override the local development URL. The script fails if an assertion or browser runtime error occurs.

This review does not establish complete WCAG conformance. Safari, Firefox, native Tauri dialogs, external integrations, and every theme/locale combination were not tested.
