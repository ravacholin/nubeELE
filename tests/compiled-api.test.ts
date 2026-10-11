import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { transform } from 'esbuild';

test('compiled Vercel API loads and serves JSON in plain Node ESM', async () => {
  const root = path.resolve(import.meta.dirname, '..');
  const output = await mkdtemp(path.join(tmpdir(), 'nubeele-api-'));
  try {
    await writeFile(path.join(output, 'package.json'), '{"type":"module"}');
    await symlink(path.join(root, 'node_modules'), path.join(output, 'node_modules'), 'dir');
    for (const source of ['api/[...path].ts', 'server.ts', 'src/server/fastCascade.ts', 'src/server/partialCloud.ts', 'src/utils/regionalVariants.ts', 'src/utils/apiKeyStorage.ts', 'src/utils/cloudWords.ts']) {
      const compiled = await transform(await readFile(path.join(root, source), 'utf8'), {
        loader: 'ts', format: 'esm', target: 'node22',
      });
      const destination = path.join(output, source.replace(/\.ts$/, '.js'));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, compiled.code);
    }
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { once } from 'node:events';
      const { default: app } = await import('./api/[...path].js');
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/generate-cloud', {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: '{"prompt":"verduras"}'
        });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type'), /application\\/json/);
        const data = await response.json();
        assert.equal(data.success, true);
        assert.equal(data.data.words.length, 15);
        console.log('compiled API passed');
      } finally {
        await new Promise(resolve => server.close(resolve));
      }
    `], { cwd: output, timeout: 15000 });
    assert.match(stdout, /compiled API passed/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
