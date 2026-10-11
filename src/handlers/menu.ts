import { confirmSave, openProject, saveProject } from 'services/platform';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { DEFAULT_PROJECT, EditorStateGetter, EditorStateSetter, HailstormProject, HailstormProjectType } from 'store/editor';
import { parse, stringify } from 'yaml';
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';

export async function handleMenuEvent(get: EditorStateGetter, set: EditorStateSetter, eventId: string) {
    switch (eventId) {
        case 'new':
            await doNew(get, set);
            break;
        case 'open':
            await doOpen(get, set);
            break;
        case 'save':
            if (!await doSave(get, set)) return;
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
    const saveCurrent = await confirmSave();
    if (saveCurrent) {
        if (!await doSave(get, set)) return;
    }
    set(state => ({
        ...state,
        filePath: null,
        script: DEFAULT_PROJECT.script,
        expressions: DEFAULT_PROJECT.behaviour,
    }));
}

async function doOpen(get: EditorStateGetter, set: EditorStateSetter) {
    const file = await openProject();
    if (file) await loadProjectContent(file.content, file.path, true, get, set);
}

export async function loadSimulationFile(path: string, askSaveCurrent: boolean, get: EditorStateGetter, set: EditorStateSetter) {
    await loadProjectContent(await readTextFile(path), path, askSaveCurrent, get, set);
}

async function loadProjectContent(content: string, path: string, askSaveCurrent: boolean, get: EditorStateGetter, set: EditorStateSetter) {
    const parsed = parseProject(content);
    if (parsed === null) throw new Error('Invalid Hailstorm project: expected a script and behaviour list.');
    if (askSaveCurrent && await confirmSave() && !await doSave(get, set)) return;
    set(state => ({
        ...state,
        filePath: path,
        script: parsed.script,
        expressions: parsed.behaviour,
    }));
}

async function doSave(get: EditorStateGetter, set: EditorStateSetter, saveAs = false): Promise<boolean> {
    const content = stringify({ script: get().script, behaviour: get().expressions });
    const projectPath = await saveProject(content, get().filePath, saveAs);
    if (projectPath === null) return false;
    set(state => ({ ...state, filePath: projectPath }));
    return true;
}

async function doSaveAs(get: EditorStateGetter, set: EditorStateSetter) {
    await doSave(get, set, true);
}

function parseProject(projectStr: string): HailstormProjectType | null {
    const parsed = parse(projectStr);
    const projectResult = HailstormProject.decode(parsed);
    return pipe(projectResult, fold(e => null, p => p));
}
