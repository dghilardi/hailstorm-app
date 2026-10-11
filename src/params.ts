import { getMatches } from "@tauri-apps/api/cli";
import { isDesktop } from 'services/platform';

interface AppParams {
    projectPath?: string,
}

export async function readParams(): Promise<AppParams> {
    if (isDesktop()) {
        let matches = await getMatches();
        let project = matches.args.project.value;
        
        return {
            projectPath: project as string | undefined,
        };
    } else {
        return {};
    }
}
