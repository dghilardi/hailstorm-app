import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { useEditorStore } from 'store/editor';
import { listen } from '@tauri-apps/api/event';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { getMatches } from '@tauri-apps/plugin-cli';

jest.mock('@tauri-apps/api/event', () => ({ listen: jest.fn() }));
jest.mock('./pages/simulation/components/Editor', () => () => <div>Rune editor</div>);
jest.mock('./pages/simulation/components/ChartPanel', () => ({ ChartPanel: () => <div>Load curve</div> }));
const initial = useEditorStore.getState();

beforeEach(() => {
    useEditorStore.setState(initial, true);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ outcome: 'idle', simulation_id: null, start_ts_ms: null, agents: [] }) });
});

afterEach(() => { delete (window as any).isTauri; });

test('browser startup exposes project actions and waits for a loaded project', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    expect(listen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'editor' }));
    expect(screen.getByText('Rune editor')).toBeInTheDocument();
});

test('agent compilation failures remain visible and keep Start disabled', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({
        outcome: 'failed', simulation_id: 'run-1', start_ts_ms: null,
        agents: [{ agent_id: 7, state: 'idle', simulation_id: 'run-1', error: 'Missing mqtt module', last_update_ms: 1000 }],
    }) });
    render(<App />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Failed'));
    expect(screen.getByRole('alert')).toHaveTextContent('Agent 7: Missing mqtt module');
    fireEvent.click(screen.getByText('1 agents · 0 ready'));
    expect(screen.getAllByText(/Missing mqtt module/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
});

test('desktop startup retains native menus, configuration and listener cleanup', async () => {
    (window as any).isTauri = true;
    const unlisten = jest.fn();
    (listen as jest.Mock).mockResolvedValue(unlisten);
    (readTextFile as jest.Mock).mockResolvedValue('backends:\n  - name: Embedded\n    hostname: localhost\n    port: 54321');
    (getMatches as jest.Mock).mockResolvedValue({ args: { project: { value: null } } });
    const { unmount } = render(<App />);
    await waitFor(() => expect(listen).toHaveBeenCalledWith('menu_event', expect.any(Function)));
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    await waitFor(() => expect(useEditorStore.getState().backends[0].name).toBe('Embedded'));
    unmount();
    await waitFor(() => expect(unlisten).toHaveBeenCalledTimes(1));
});

test('desktop command-line project errors are shown instead of becoming unhandled rejections', async () => {
    (window as any).isTauri = true;
    (listen as jest.Mock).mockResolvedValue(jest.fn());
    (getMatches as jest.Mock).mockResolvedValue({ args: { project: { value: '/missing.hsp' } } });
    (readTextFile as jest.Mock).mockImplementation((path: string) => path === '/missing.hsp'
        ? Promise.reject(new Error('Project file is missing'))
        : Promise.resolve('backends:\n  - name: Embedded\n    hostname: localhost\n    port: 54321'));
    render(<App />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Project file is missing'));
});
