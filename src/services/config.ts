import { BaseDirectory } from '@tauri-apps/api/fs';
import { readTextFile, writeTextFile, createDir } from '@tauri-apps/api/fs';
import YAML from 'yaml';
import * as t from 'io-ts';
import { HailstormBackend } from 'services/hailstorm';
import { isDesktop } from 'services/platform';
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';

export const HailstormConfig = t.type({
    backends: t.array(HailstormBackend),
});
export type HailstormConfigType = t.TypeOf<typeof HailstormConfig>;

const CONFIG_DIR_PATH = "hailstorm-app";
const CONFIG_FILE_PATH = `${CONFIG_DIR_PATH}/config.yml`;

export async function loadConfig(): Promise<HailstormConfigType> {
    if (!isDesktop()) return defaultConfig();
    let configStr;
    try {
        configStr = await readTextFile(CONFIG_FILE_PATH, { dir: BaseDirectory.Config });
    } catch (err) {
        console.warn('Config file not found, creating a new one!');
        await createDir(CONFIG_DIR_PATH, { dir: BaseDirectory.Config, recursive: true });
        const defaultConfigStr = YAML.stringify(defaultConfig());
        await writeTextFile(CONFIG_FILE_PATH, defaultConfigStr, { dir: BaseDirectory.Config });
        configStr = defaultConfigStr;
    }
    try {
        return pipe(HailstormConfig.decode(YAML.parse(configStr)), fold(e => defaultConfig(), ok => ok.backends.length ? ok : defaultConfig()));
    } catch {
        return defaultConfig();
    }
}

export function defaultConfig(): HailstormConfigType {
    return {
        backends: isDesktop() ? [{
            name: 'Embedded',
            hostname: 'localhost',
            port: 54321,
        }] : [{ name: 'Controller', baseUrl: '/api' }],
    };
}
