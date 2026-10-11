import { defaultConfig, loadConfig } from './config';
import { isDesktop, saveProject } from './platform';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';

jest.mock('@tauri-apps/plugin-fs', () => ({
    BaseDirectory: { Config: 11 }, readTextFile: jest.fn(), writeTextFile: jest.fn(), mkdir: jest.fn(),
}));
jest.mock('@tauri-apps/plugin-dialog', () => ({ save: jest.fn() }));

afterEach(() => {
    delete (window as any).isTauri;
    jest.clearAllMocks();
});

test('browser startup uses the controller on the page origin without native calls', async () => {
    expect(isDesktop()).toBe(false);
    await expect(loadConfig()).resolves.toEqual({ backends: [{ name: 'Controller', baseUrl: '/api' }] });
    expect(readTextFile).not.toHaveBeenCalled();
});

test('desktop startup reads existing backend configuration', async () => {
    (window as any).isTauri = true;
    (readTextFile as jest.Mock).mockResolvedValue('backends:\n  - name: Remote\n    hostname: host\n    port: 8080');
    expect(isDesktop()).toBe(true);
    expect(defaultConfig().backends[0].name).toBe('Embedded');
    await expect(loadConfig()).resolves.toEqual({ backends: [{ name: 'Remote', hostname: 'host', port: 8080 }] });
});

test('desktop invalid or empty configuration falls back to embedded', async () => {
    (window as any).isTauri = true;
    (readTextFile as jest.Mock).mockResolvedValue('backends: []');
    await expect(loadConfig()).resolves.toEqual(defaultConfig());
    (readTextFile as jest.Mock).mockResolvedValue('backends: [');
    await expect(loadConfig()).resolves.toEqual(defaultConfig());
});

test('canceling the desktop save dialog does not write a file', async () => {
    (window as any).isTauri = true;
    (save as jest.Mock).mockResolvedValue(null);
    await expect(saveProject('script: test', null)).resolves.toBeNull();
    expect(writeTextFile).not.toHaveBeenCalled();
});

test('desktop save preserves direct writes to an already opened file', async () => {
    (window as any).isTauri = true;
    await expect(saveProject('script: test', '/tmp/test.hsp')).resolves.toBe('/tmp/test.hsp');
    expect(writeTextFile).toHaveBeenCalledWith('/tmp/test.hsp', 'script: test');
    expect(save).not.toHaveBeenCalled();
});
