import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('version is shared and asset URLs stay relative', () => {
  const versionFile = fs.readFileSync(path.join(root, 'js/version.js'), 'utf8');
  const version = versionFile.match(/VERSION = '([^']+)'/)[1];
  assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), new RegExp(`VERSION = '${version}'`));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes(`?v=${version}`));
  assert.ok(!/src=["']\//.test(html));
  assert.ok(!/href=["']\//.test(html));

  function walk(dir, out = []) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full, out);
      else if (name.endsWith('.js')) out.push(full);
    }
    return out;
  }

  for (const file of walk(path.join(root, 'js'))) {
    const text = fs.readFileSync(file, 'utf8');
    const imports = text.match(/from '\.[^']+'/g) || [];
    for (const spec of imports) {
      assert.ok(spec.includes(`?v=${version}`), `${path.relative(root, file)} ${spec}`);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) assert.ok(icon.src.startsWith('./'), icon.src);

  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.ok(sw.includes(`?v=${version}`));
  assert.ok(!sw.includes("'/js/") && !sw.includes('"/js/'));
  const assets = [...sw.matchAll(/'\.\/([^']*)'/g)].map((match) => match[1].split('?')[0]);
  for (const asset of assets) {
    if (!asset) continue;
    assert.ok(fs.existsSync(path.join(root, asset)), asset);
  }
});
