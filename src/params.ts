import { getMatches } from "@tauri-apps/api/cli";

interface AppParams {
    projectPath?: string,
}

export async function readParams(): Promise<AppParams> {
    if ('__TAURI__' in window) {
        let matches = await getMatches();
        let project = matches.args.project.value;
        
        return {
            projectPath: project as string | undefined,
        };
    } else {
        return {};
    }
}