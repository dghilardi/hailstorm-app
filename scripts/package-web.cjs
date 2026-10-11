const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appVersion = require('../package.json').version;
const version = process.argv[2] || appVersion;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('Expected a version such as 0.3.0 or 0.3.0-rc.1');
}

require('./prepare-assets.cjs');
execFileSync(process.execPath, [require.resolve('react-scripts/scripts/build')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PUBLIC_URL: '.' },
});

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== '';
writeFileSync(path.join(root, 'build/hailstorm-web.json'), JSON.stringify({ version, appVersion, sourceCommit, sourceDirty }, null, 2) + '\n');
const artifacts = path.join(root, 'artifacts');
mkdirSync(artifacts, { recursive: true });
const name = `hailstorm-web-${version}.tar.gz`;
const archive = path.join(artifacts, name);
execFileSync('tar', ['-czf', archive, '-C', path.join(root, 'build'), '.'], { stdio: 'inherit' });
const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
writeFileSync(`${archive}.sha256`, `${checksum}  ${name}\n`);
console.log(`Created artifacts/${name} and its SHA-256 checksum`);
