import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const code = readFileSync(new URL('../public/annotations.js', import.meta.url), 'utf8');
function fixture(annotation) {
  const events = new Map();
  const attrs = new Map();
  const clicks = new Map();
  const children = [];
  const button = { setAttribute: (k, v) => attrs.set(k, v), addEventListener: (k, v) => clicks.set(k, v) };
  const document = { oai: { annotation }, getElementById: () => children[0], createElement: () => button,
    body: { append: b => children.push(b) }, addEventListener: (k, v) => events.set(k, v) };
  const window = { addEventListener: (k, v) => events.set(k, v) };
  vm.runInNewContext(code, { document, window });
  return { document, window, events, attrs, clicks, button, children };
}
test('unsupported browsers retain a hidden, inert entry point', () => {
  const f = fixture(undefined);
  assert.equal(f.button.hidden, true);
  assert.doesNotThrow(() => f.clicks.get('click')());
});
test('initial state, confirmed changes, rejection and revocation', () => {
  let active = false;
  const requests = [];
  const f = fixture({ isActive: () => active, toggle: value => { requests.push(value); return { accepted: false }; } });
  assert.equal(f.button.hidden, false);
  assert.equal(f.attrs.get('aria-pressed'), 'false');
  f.clicks.get('click')();
  assert.deepEqual(requests, [true]);
  assert.equal(f.attrs.get('aria-pressed'), 'false');
  active = true;
  f.events.get('oaiannotationmodechange')();
  assert.equal(f.attrs.get('aria-pressed'), 'true');
  assert.equal(f.button.textContent, 'Exit annotation mode');
  f.clicks.get('click')();
  assert.deepEqual(requests, [true, false]);
  f.document.oai = undefined;
  f.events.get('oaiannotationmodechange')();
  assert.equal(f.button.hidden, true);
  assert.doesNotThrow(() => f.clicks.get('click')());
});
test('pageshow refresh and duplicate execution do not duplicate controls', () => {
  const f = fixture(undefined);
  f.document.oai.annotation = { isActive: () => true, toggle() {} };
  f.events.get('pageshow')();
  assert.equal(f.attrs.get('aria-pressed'), 'true');
  vm.runInNewContext(code, { document: f.document, window: f.window });
  assert.equal(f.children.length, 1);
});
test('all three independently deployed frontends have identical adapters', () => {
  for (const path of ['apps/site/src', 'apps/docs/docs/assets/annotations']) {
    assert.equal(readFileSync(new URL(`../${path}/annotations.js`, import.meta.url), 'utf8'), code);
    assert.equal(readFileSync(new URL(`../${path}/annotations.css`, import.meta.url), 'utf8'), readFileSync(new URL('../public/annotations.css', import.meta.url), 'utf8'));
  }
  assert.doesNotMatch(code, /oai-annotation-container/);
});
test('throwing capabilities hide the control without breaking events or clicks', () => {
  const initial = fixture({ isActive() { throw new Error('revoked'); }, toggle() {} });
  assert.equal(initial.button.hidden, true);
  let revoked = false;
  const f = fixture({ isActive() { if (revoked) throw new Error('revoked'); return false; }, toggle() { throw new Error('denied'); } });
  assert.doesNotThrow(() => f.clicks.get('click')());
  assert.equal(f.button.hidden, true);
  revoked = true;
  assert.doesNotThrow(() => f.events.get('oaiannotationmodechange')());
  assert.equal(f.button.hidden, true);
  assert.equal(f.attrs.get('aria-pressed'), 'false');
});
