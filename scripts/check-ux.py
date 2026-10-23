"""Browser regression checks for the core UX flows.

Requires Python Playwright and Chromium. Start `npm run dev`, then run:
    python scripts/check-ux.py
Optional: VAMPIO_TEST_URL, CHROMIUM_PATH. Uses a fresh, disposable browser profile.
"""
import csv
import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def in_view(locator, page):
    rect = locator.bounding_box()
    assert rect and rect['x'] >= -1 and rect['y'] >= -1, rect
    assert rect['x'] + rect['width'] <= page.viewport_size['width'] + 1, rect
    assert rect['y'] + rect['height'] <= page.viewport_size['height'] + 1, rect


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        args=['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'],
    )
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('VAMPIO_TEST_URL', 'http://127.0.0.1:3000/'), wait_until='networkidle')

    dialog = page.get_by_role('dialog', name='Choose Your Workspace Mode')
    expect(dialog).to_be_visible()
    in_view(dialog, page)
    expect(dialog.get_by_role('heading', name='Choose Your Workspace Mode')).to_be_in_viewport()
    close = dialog.get_by_role('button', name='Close workspace mode selection')
    close.focus()
    page.keyboard.press('Shift+Tab')
    continuation = dialog.get_by_role('button', name='Continue in Operator Mode')
    expect(continuation).to_be_focused()
    in_view(continuation, page)
    page.keyboard.press('Tab')
    expect(close).to_be_focused()
    dialog.get_by_role('radio', name='Developer Studio', exact=True).check()
    dialog.get_by_role('button', name='Continue in Developer Studio').click()
    expect(dialog).not_to_be_visible()
    print('PASS: mobile onboarding, scrolling, role selection, focus trap')

    for width, height in [(320, 568), (390, 844), (640, 700), (768, 1024), (1440, 1000)]:
        page.set_viewport_size({'width': width, 'height': height})
        in_view(page.get_by_role('button', name='Theme menu'), page)
        navigation = page.get_by_role('tablist').first
        assert navigation.locator('[role=tab][tabindex="0"]').count() == 1
        navigation.locator('[role=tab][tabindex="0"]').focus()
        page.keyboard.press('Home')
        expect(navigation.get_by_role('tab').first).to_be_focused()
        page.keyboard.press('ArrowRight')
        expect(navigation.get_by_role('tab').nth(1)).to_be_focused()
        expect(navigation.get_by_role('tab').nth(1)).to_have_attribute('aria-selected', 'true')
        page.keyboard.press('End')
        expect(navigation.get_by_role('tab').last).to_be_focused()
        page.keyboard.press('ArrowRight')
        expect(navigation.get_by_role('tab').first).to_be_focused()
        in_view(navigation.get_by_role('tab').first, page)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        print(f'PASS: responsive header and keyboard tabs at {width}x{height}')

    page.set_viewport_size({'width': 390, 'height': 844})
    trigger = page.get_by_role('button', name='Browse Presets', exact=True)
    trigger.click()
    presets = page.get_by_role('dialog', name='Preset Schemas & Templates')
    expect(presets).to_be_visible()
    in_view(presets, page)
    search = presets.get_by_role('textbox', name='Search presets')
    expect(search).to_be_focused()
    search.fill('no-such-preset-xyz')
    expect(presets.get_by_role('status')).to_contain_text('No matching presets')
    presets.get_by_role('button', name='Clear filters').click()
    expect(presets.get_by_role('button', name='Load Schema').first).to_be_visible()
    page.keyboard.press('Escape')
    expect(presets).not_to_be_visible()
    expect(trigger).to_be_focused()
    trigger.click()
    search.fill('E-Commerce')
    presets.get_by_role('button', name='Load Schema').click()
    expect(presets).not_to_be_visible()
    print('PASS: preset search, empty state, loading, Escape and focus restoration')

    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.get_by_role('tab', name='Live Inspector', exact=False).click()
    expect(page.get_by_text('Order_ID', exact=True).first).to_be_visible()
    with page.expect_download() as download:
        page.get_by_role('button', name='Generate', exact=True).click()
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'generated.csv'
        download.value.save_as(path)
        with path.open() as stream:
            rows = list(csv.DictReader(stream))
        assert len(rows) == 1000
        assert 'Order_Total' in rows[0] and all('@' in row['Customer_Email'] for row in rows)
    print('PASS: live preview and 1,000-row CSV export')

    page.keyboard.press('Control+k')
    switcher = page.get_by_role('dialog', name='Switch workspace')
    combo = switcher.get_by_role('combobox')
    expect(combo).to_be_focused()
    combo.fill('no-match-workspace-xyz')
    page.keyboard.press('ArrowUp')
    page.keyboard.press('ArrowDown')
    assert combo.get_attribute('aria-activedescendant') is None
    combo.fill('  Workspace 1  ')
    expect(switcher.get_by_role('option')).to_have_count(1)
    combo.fill('UX review workspace')
    switcher.get_by_role('button', name='Create "UX review workspace" as New Workspace', exact=True).focus()
    page.keyboard.press('Enter')
    expect(switcher).not_to_be_visible()
    page.keyboard.press('Control+k')
    expect(combo).to_be_focused()
    combo.fill('UX review workspace')
    expect(switcher.get_by_role('option')).to_have_count(1)
    page.keyboard.press('Escape')
    expect(switcher).not_to_be_visible()
    print('PASS: workspace filtering, empty results, single keyboard creation')

    page.get_by_role('button', name='Theme menu').click()
    page.get_by_role('button', name='Nordic Snow', exact=False).click()
    expect(page.locator('html')).to_have_class('theme-nordic')
    assert not errors, errors
    print('PASS: light theme switching and no browser runtime errors')
    browser.close()
