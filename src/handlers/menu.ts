import { save, open, DialogFilter } from '@tauri-apps/api/dialog';
import { readTextFile } from '@tauri-apps/api/fs';
import { EditorStateGetter, EditorStateSetter } from 'store/editor';

const FILE_FILTERS_HAILSTORM_PROJECT: DialogFilter[] = [
    { name: 'Hailstorm project', extensions: ['hsp'] }
];

export async function handleMenuEvent(get: EditorStateGetter, set: EditorStateSetter, eventId: string) {
    switch (eventId) {
        case 'open': {
            const path = await open({ multiple: false, filters: FILE_FILTERS_HAILSTORM_PROJECT });
            if (path !== null) {
                const content = await readTextFile(path as string);
            }
        }
            break;
        case 'save': {
            let projectPath = get().filePath;
            if (projectPath === null) {
                projectPath = await save({ filters: FILE_FILTERS_HAILSTORM_PROJECT });
                set((state) => ({ ...state, filePath: projectPath }));
            }
        }
            break;
        case 'save-as': {
            const projectPath = await save({ filters: FILE_FILTERS_HAILSTORM_PROJECT });
            set((state) => ({ ...state, filePath: projectPath }));
        }
            break;
        default:
            console.log(`event ${eventId} is not currently handled`);
            break;
    }
}