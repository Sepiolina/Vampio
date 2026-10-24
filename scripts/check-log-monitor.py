"""Browser regression: inspect mixed logs, export artifacts, import a profile, and generate JSONL.
Requires Python Playwright and Chromium. Start npm run dev, then run python scripts/check-log-monitor.py.
Uses disposable browser data and synthetic in-memory source files.
"""
from playwright.sync_api import sync_playwright, expect
import json, tempfile, re, os
from pathlib import Path
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox', '--no-proxy-server'])
    page = b.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce', accept_downloads=True)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_default_timeout(15000)
    page.goto(os.environ.get('VAMPIO_TEST_URL', 'http://127.0.0.1:3000/'), wait_until='networkidle')
    page.get_by_role('button', name='Launch Operator Mode').click()
    with page.expect_file_chooser() as fc:
        page.get_by_role('button', name='Select files snapshot', exact=True).click()
    fc.value.set_files([{'name': 'events.log', 'mimeType': 'text/plain', 'buffer': b'{"timestamp":"2026-10-25T10:00:00Z","level":"INFO","message":"started","latency_ms":12}\n{"timestamp":"2026-10-25T10:00:02Z","level":"WARN","message":"slow","latency_ms":81}\n'}, {'name': 'machine.csv', 'mimeType': 'text/csv', 'buffer': 'timestamp;station;temperature\r\n2026-10-25 10:00:00;ก;24.5\r\n2026-10-25 10:00:01;ข;26.0\r\n'.encode('utf-16')}])
    exports = page.get_by_role('region', name='Export log analysis')
    expect(exports).to_be_visible()
    expect(page.get_by_text('Uploaded snapshot · no live refresh', exact=True)).to_be_visible()
    expect(page.get_by_role('checkbox', name='Auto refresh')).to_be_disabled()
    profiles = page.get_by_role('region', name='Per-file log profiles')
    profiles.locator('summary').filter(has_text='machine.csv').click()
    page.get_by_role('button', name='Use machine.csv for simulation', exact=True).click()
    expect(exports).to_contain_text('machine.csv (3 fields)')
    expect(page.get_by_text('UTF-16 LE', exact=True).first).to_be_visible()
    profiles.locator('summary').filter(has_text='events.log').click()
    page.get_by_role('button', name='Use events.log for simulation', exact=True).click()
    expect(exports).to_contain_text('events.log (4 fields)')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    print('PASS snapshot labeling and mixed-file schema/encoding selection at390px')
    with tempfile.TemporaryDirectory() as directory:
        base = Path(directory)
        for label, filename in [('Profile JSON', 'profile.json'), ('Simulation template JSON', 'template.json'), ('Markdown report', 'report.md')]:
            with page.expect_download() as dl:
                exports.get_by_role('button', name=label, exact=False).click()
            dl.value.save_as(base / filename)
        bundle = json.loads((base / 'profile.json').read_text())
        schema = json.loads((base / 'template.json').read_text())
        report = (base / 'report.md').read_text()
        assert bundle['vampioWorkspace']['format'] == 'jsonl' and len(bundle['vampioWorkspace']['columns']) == 4
        assert bundle['samplesIncluded'] is False and bundle['samplePreview']['rawSnippet'] == ''
        assert all((not f['sampleRows'] for f in bundle['fileProfiles']))
        assert schema['tableName'] and len(schema['columns']) == 4
        assert 'UTF-16 LE' in report and 'events.log' in report and ('machine.csv' in report)
        assert 'started' not in report
        exports.get_by_role('checkbox').check()
        with page.expect_download() as dl:
            exports.get_by_role('button', name='Markdown report', exact=False).click()
        dl.value.save_as(base / 'samples.md')
        assert 'started' in (base / 'samples.md').read_text()
        print('PASS three downloads, source schema, raw samples opt-in and Markdown evidence')
        page.set_viewport_size({'width': 1440, 'height': 1000})
        page.get_by_role('button', name='Switch to Developer Studio', exact=False).click()
        page.get_by_role('button', name='Others', exact=True).click()
        page.get_by_text('Import Machine Profile Bundle', exact=True).click()
        dialog = page.get_by_role('dialog', name='Import Behavior Profile Bundle')
        expect(dialog).to_be_visible()
        invalid = {**bundle, 'source': {'platform': 'web'}}
        dialog.locator('input[type=file]').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': json.dumps(invalid).encode()})
        expect(dialog.get_by_role('alert')).to_contain_text('Invalid source')
        dialog.locator('input[type=file]').set_input_files(str(base / 'profile.json'))
        expect(dialog.get_by_text('Simulation starts as a new download.', exact=False)).to_be_visible()
        page.screenshot(path='/tmp/vampio-import-desktop.png')
        dialog.get_by_role('button', name='Open as New Workspace Tab').click()
        expect(dialog).not_to_be_visible()
        page.get_by_role('tab', name='Live Inspector', exact=False).click()
        expect(page.get_by_text('latency_ms', exact=True).first).to_be_visible()
        page.get_by_role('button', name='Expand Generation Deck', exact=True).click()
        page.get_by_role('tab', name='Batch File', exact=True).click()
        page.get_by_role('button', name=re.compile('^Single File')).click()
        with page.expect_download() as generated:
            page.get_by_role('button', name=re.compile('^Generate')).click()
        generated.value.save_as(base / 'synthetic.jsonl')
        synthetic = [json.loads(line) for line in (base / 'synthetic.jsonl').read_text().splitlines()]
        assert len(synthetic) == 500 and all((isinstance(row['latency_ms'], int) for row in synthetic))
        print('PASS profile re-import into new workspace and 500 JSONL records generated')
        page.screenshot(path='/tmp/vampio-log-studio.png')
    print('ERRORS', errors)
    assert not errors
    b.close()
