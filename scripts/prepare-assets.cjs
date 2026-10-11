const { cpSync, mkdirSync, rmSync } = require('node:fs');
const path = require('node:path');

const destination = path.resolve(__dirname, '../public/monaco/vs');
rmSync(destination, { recursive: true, force: true });
mkdirSync(path.dirname(destination), { recursive: true });
cpSync(path.dirname(require.resolve('monaco-editor/min/vs/loader.js')), destination, { recursive: true });
cpSync(require.resolve('monaco-editor/LICENSE'), path.join(path.dirname(destination), 'LICENSE'));
