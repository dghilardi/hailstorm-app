import { save, open, DialogFilter, ask } from '@tauri-apps/api/dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs';
import { DEFAULT_PROJECT, EditorStateGetter, EditorStateSetter, HailstormProject, HailstormProjectType } from 'store/editor';
import { parse, stringify } from 'yaml';
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';

const FILE_FILTERS_HAILSTORM_PROJECT: DialogFilter[] = [
    { name: 'Hailstorm project', extensions: ['hsp'] }
];

export async function handleMenuEvent(get: EditorStateGetter, set: EditorStateSetter, eventId: string) {
    switch (eventId) {
        case 'new':
            await doNew(get, set);
            break;
        case 'open':
            await doOpen(get, set);
            break;
        case 'save':
            await doSave(get, set);
            break;
        case 'save-as':
            await doSaveAs(get, set);
            break;
        default:
            console.log(`event ${eventId} is not currently handled`);
            break;
    }
}

async function doNew(get: EditorStateGetter, set: EditorStateSetter) {
    const saveCurrent = await ask('Do you want to save the current project?');
    if (saveCurrent) {
        await doSave(get, set);
    }
    set(state => ({
        ...state,
        filePath: null,
        script: DEFAULT_PROJECT.script,
        expressions: DEFAULT_PROJECT.behaviour,
    }));
}

async function doOpen(get: EditorStateGetter, set: EditorStateSetter) {
    const path = await open({ multiple: false, filters: FILE_FILTERS_HAILSTORM_PROJECT });
    if (path !== null) {
        loadSimulationFile(path as string, true, get, set);
    }
}

export async function loadSimulationFile(path: string, askSaveCurrent: boolean, get: EditorStateGetter, set: EditorStateSetter) {
    const content = await readTextFile(path as string);
    const parsed = parseProject(content);
    if (parsed !== null) {
        const saveCurrent = askSaveCurrent ? await ask('Do you want to save the current project?') : false;
        if (saveCurrent) {
            await doSave(get, set);
        }
        set(state => ({
            ...state,
            filePath: path as string,
            script: parsed.script,
            expressions: parsed.behaviour,
        }));
    }
}

async function doSave(get: EditorStateGetter, set: EditorStateSetter) {
    let projectPath = get().filePath;
    if (projectPath === null) {
        projectPath = await save({ filters: FILE_FILTERS_HAILSTORM_PROJECT });
        set((state) => ({ ...state, filePath: projectPath }));
    }
    await writeProject({ script: get().script, behaviour: get().expressions }, projectPath);
}

async function doSaveAs(get: EditorStateGetter, set: EditorStateSetter) {
    const projectPath = await save({ filters: FILE_FILTERS_HAILSTORM_PROJECT });
    await writeProject({ script: get().script, behaviour: get().expressions }, projectPath);
    set((state) => ({ ...state, filePath: projectPath }));
}

function parseProject(projectStr: string): HailstormProjectType | null {
    const parsed = parse(projectStr);
    const projectResult = HailstormProject.decode(parsed);
    return pipe(projectResult, fold(e => null, p => p));
}

async function writeProject(project: HailstormProjectType, path: string) {
    const serialized = stringify(project);
    await writeTextFile(path, serialized);
}