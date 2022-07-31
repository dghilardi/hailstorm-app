import { save, open, DialogFilter } from '@tauri-apps/api/dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
import { EditorStateGetter, EditorStateSetter } from 'store/editor';
import { parse, stringify } from 'yaml';
import * as t from 'io-ts'
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';

const FILE_FILTERS_HAILSTORM_PROJECT: DialogFilter[] = [
    { name: 'Hailstorm project', extensions: ['hsp'] }
];

export async function handleMenuEvent(get: EditorStateGetter, set: EditorStateSetter, eventId: string) {
    switch (eventId) {
        case 'open': {
            const path = await open({ multiple: false, filters: FILE_FILTERS_HAILSTORM_PROJECT });
            if (path !== null) {
                const content = await readTextFile(path as string);
                const parsed = parseProject(content);
                if (parsed !== null) {
                    set(state => ({
                        ...state,
                        filePath: path as string,
                        script: parsed.script,
                        expressions: parsed.behaviour,
                    }));
                }
            }
        }
            break;
        case 'save': {
            let projectPath = get().filePath;
            if (projectPath === null) {
                projectPath = await save({ filters: FILE_FILTERS_HAILSTORM_PROJECT });
                set((state) => ({ ...state, filePath: projectPath }));
            }
            await writeProject({ script: get().script, behaviour: get().expressions }, projectPath);
        }
            break;
        case 'save-as': {
            const projectPath = await save({ filters: FILE_FILTERS_HAILSTORM_PROJECT });
            await writeProject({ script: get().script, behaviour: get().expressions }, projectPath);
            set((state) => ({ ...state, filePath: projectPath }));
        }
            break;
        default:
            console.log(`event ${eventId} is not currently handled`);
            break;
    }
}

const ModelExpression = t.type({
    model: t.string,
    expression: t.string,
});

const HailstormProject = t.type({
    script: t.string,
    behaviour: t.array(ModelExpression),
})

type HailstormProjectType = t.TypeOf<typeof HailstormProject>;

function parseProject(projectStr: string): HailstormProjectType | null {
    const parsed = parse(projectStr);
    const projectResult = HailstormProject.decode(parsed);
    return pipe(projectResult, fold(e => null, p => p));
}

async function writeProject(project: HailstormProjectType, path: string) {
    const serialized = stringify(project);
    await writeTextFile(path, serialized);
}