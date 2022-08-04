import { BaseDirectory } from '@tauri-apps/api/fs';
import { readTextFile, writeTextFile, createDir } from '@tauri-apps/api/fs';
import YAML from 'yaml';
import * as t from 'io-ts';
import { HailstormBackend } from 'store/editor';
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';

export const HailstormConfig = t.type({
    backends: t.array(HailstormBackend),
});
export type HailstormConfigType = t.TypeOf<typeof HailstormConfig>;

const CONFIG_DIR_PATH = "hailstorm-app";
const CONFIG_FILE_PATH = `${CONFIG_DIR_PATH}/config.yml`;

export async function loadConfig(): Promise<HailstormConfigType> {
    let configStr;
    try {
        configStr = await readTextFile(CONFIG_FILE_PATH, { dir: BaseDirectory.Config });
        console.debug(`Reading config file ${CONFIG_FILE_PATH}\n${configStr}`);
    } catch (err) {
        console.warn('Config file not found, creating a new one!');
        await createDir(CONFIG_DIR_PATH, { dir: BaseDirectory.Config, recursive: true });
        const defaultConfigStr = YAML.stringify(defaultConfig());
        await writeTextFile(CONFIG_FILE_PATH, defaultConfigStr, { dir: BaseDirectory.Config });
        configStr = defaultConfigStr;
    }
    return pipe(HailstormConfig.decode(YAML.parse(configStr)), fold(e => defaultConfig(), ok => ok));
}

function defaultConfig(): HailstormConfigType {
    return {
        backends: [{
            name: 'Embedded',
            hostname: 'localhost',
            port: 54321,
        }],
    };
}