import { isTauri } from '@tauri-apps/api/core';

export function isDesktop(): boolean {
    return isTauri();
}

export async function confirmSave(): Promise<boolean> {
    if (isDesktop()) {
        const { ask } = await import('@tauri-apps/plugin-dialog');
        return ask('Do you want to save the current project?');
    }
    return window.confirm('Do you want to export the current project before continuing?');
}

export async function openProject(): Promise<{ path: string, content: string } | null> {
    if (isDesktop()) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const path = await open({ multiple: false, filters: [{ name: 'Hailstorm project', extensions: ['hsp'] }] });
        return typeof path === 'string' ? { path, content: await readTextFile(path) } : null;
    }
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.hsp';
        input.hidden = true;
        input.addEventListener('cancel', () => { input.remove(); resolve(null); });
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            input.remove();
            try {
                resolve(file ? { path: file.name, content: await file.text() } : null);
            } catch (error) { reject(error); }
        });
        document.body.appendChild(input);
        input.click();
    });
}

export async function saveProject(content: string, path: string | null, saveAs = false): Promise<string | null> {
    if (isDesktop()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        const target = path && !saveAs ? path : await save({ filters: [{ name: 'Hailstorm project', extensions: ['hsp'] }] });
        if (target === null) return null;
        await writeTextFile(target, content);
        return target;
    }
    const filename = path || 'simulation.hsp';
    const url = URL.createObjectURL(new Blob([content], { type: 'application/yaml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return filename;
}
