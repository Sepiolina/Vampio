"""Regression checks for monitor typing, responsive actions, and time/status exports.

Requires Python Playwright and Chromium. Start npm run dev before running this script.
VAMPIO_TEST_URL and CHROMIUM_PATH may override the local defaults.
"""
import csv
import io
import json
import os
import re
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
        args=['--no-sandbox', '--no-proxy-server'],
    )
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce', accept_downloads=True)
    page.set_default_timeout(15000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ.get('VAMPIO_TEST_URL', 'http://127.0.0.1:3000/'), wait_until='networkidle')
    page.get_by_role('button', name='Launch Developer Studio').click()
    page.get_by_role('button', name='Others', exact=True).click()
    page.get_by_text('Target Folder Behavior Monitor', exact=True).click()
    dialog = page.get_by_role('dialog', name='Target Folder Behavior Monitor')
    expect(dialog).to_be_visible()
    statuses = ['OK', 'Error', 'not OK']
    source = io.StringIO()
    writer = csv.writer(source)
    writer.writerow(['clock', 'result', 'part_no', 'description'])
    for index in range(60):
        writer.writerow([
            f'09:{index:02d}:15', statuses[index % 3], f'SN-{index:04d}',
            f'Technician checked station {index} and recorded a detailed inspection message.',
        ])
    with page.expect_file_chooser() as chooser:
        dialog.get_by_role('button', name='Batch Files', exact=True).click()
    chooser.value.set_files({
        'name': 'Factory_Production_Conveyor_Inspection_Results_' * 4 + '.csv',
        'mimeType': 'text/csv', 'buffer': source.getvalue().encode(),
    })
    exports = dialog.get_by_role('region', name='Export log analysis')
    expect(exports).to_be_visible()
    page.wait_for_timeout(350)
    for width, height in [(320, 420), (320, 700), (390, 844), (768, 400), (768, 800), (1024, 768), (1440, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert dialog.evaluate('''element => {
            const bounds = element.getBoundingClientRect();
            return [...element.querySelectorAll('button')].every(button => {
                const rect = button.getBoundingClientRect();
                return !rect.width || rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
            });
        }'''), f'Action extends outside monitor at {width}x{height}'
        for tab in dialog.get_by_role('tab').all():
            tab.scroll_into_view_if_needed()
            assert tab.evaluate('element => {const r=element.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth}')
    print('PASS monitor actions and tabs fit seven desktop, phone and short-height layouts')
    page.set_viewport_size({'width': 1440, 'height': 900})
    dialog.get_by_role('tab', name='Discovered Schema', exact=True).click()
    result_row = dialog.get_by_role('cell', name='result', exact=True).locator('..')
    expect(result_row).to_contain_text('Set/Enum')
    expect(result_row).to_contain_text('3 distinct')
    expect(dialog.get_by_role('cell', name='part_no', exact=True).locator('..')).to_contain_text('RegEx')
    expect(dialog.get_by_role('cell', name='description', exact=True).locator('..')).to_contain_text('String')
    dialog.get_by_text('How Enum, Regex and String are chosen', exact=True).click()
    expect(dialog.get_by_text('Decisions use up to 200 records', exact=False)).to_be_visible()
    print('PASS value-based Enum / Regex / String decisions and visible explanations')
    with tempfile.TemporaryDirectory() as directory:
        destination = Path(directory)
        with page.expect_download() as profile:
            exports.get_by_role('button', name='Profile JSON', exact=False).click()
        profile.value.save_as(destination / 'profile.json')
        bundle = json.loads((destination / 'profile.json').read_text())
        inferred = {column['name']: column for column in bundle['vampioWorkspace']['columns']}
        assert inferred['result']['type'] == 'Set/Enum'
        assert inferred['part_no']['type'] == 'RegEx'
        assert inferred['description']['type'] == 'String'
        assert inferred['clock']['type'] == 'DateTime' and inferred['clock']['rule'] == 'time'
        assert all('valueFrequencies' not in column for profile in bundle['fileProfiles'] for column in profile['columns'])
        dialog.get_by_role('button', name='Apply Recommendations', exact=True).click()
        expect(dialog).not_to_be_visible()
        page.get_by_role('button', name='Expand Generation Deck', exact=True).click()
        page.get_by_role('tab', name='Batch File', exact=True).click()
        page.get_by_role('button', name=re.compile(r'^Single File')).click()
        with page.expect_download() as download:
            page.get_by_role('button', name=re.compile(r'^Generate')).click()
        download.value.save_as(destination / 'simulation.csv')
        with (destination / 'simulation.csv').open() as stream:
            rows = list(csv.DictReader(stream))
        assert rows and len(rows) == bundle['vampioWorkspace']['batchCount']
        assert all(re.fullmatch(r'\d{2}:\d{2}:\d{2}', row['clock']) for row in rows)
        assert all(row['result'] in statuses and re.fullmatch(r'SN-\d{4}', row['part_no']) for row in rows)
        assert {row['result'] for row in rows} == set(statuses)
        assert '#######' not in (destination / 'simulation.csv').read_text()
        print(f'PASS {len(rows)} CSV records contain real time-only values and only observed status labels')
        page.get_by_role('button', name='Use XLSX with fitted columns').click()
        with page.expect_download() as workbook:
            page.get_by_role('button', name=re.compile(r'^Generate')).click()
        workbook.value.save_as(destination / 'simulation.xlsx')
        with zipfile.ZipFile(destination / 'simulation.xlsx') as archive:
            sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
            namespace = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            widths = sheet.findall('x:cols/x:col', namespace)
            assert widths and float(widths[0].attrib['width']) >= 10
        print('PASS Excel alternative downloads a workbook with fitted time columns')
    assert not errors, errors
    browser.close()
