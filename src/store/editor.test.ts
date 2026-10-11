import { canLoadSimulation, canStartSimulation, canStopSimulation, useEditorStore } from './editor';

const initial = useEditorStore.getState();
const fetchMock = jest.fn();
const agent = { agent_id: 1, state: 'ready', simulation_id: 'run-1', error: null, last_update_ms: 1000 };
let serverStatus: any;
let statusCode: number;

beforeEach(() => {
    useEditorStore.setState(initial, true);
    statusCode = 200;
    serverStatus = { outcome: 'idle', simulation_id: null, start_ts_ms: null, agents: [] };
    fetchMock.mockImplementation(async (url: string) => {
        let body: unknown;
        let code = 200;
        if (url.endsWith('/status')) { body = serverStatus; code = statusCode; }
        else if (url.endsWith('/load')) body = { simulation_id: 'run-1' };
        else if (url.endsWith('/start')) {
            serverStatus = { ...serverStatus, outcome: 'running', start_ts_ms: 1000, agents: [{ ...agent, state: 'running' }] };
            body = { outcome: 'ok' };
        } else if (url.endsWith('/stop')) {
            serverStatus = { outcome: 'idle', simulation_id: null, start_ts_ms: null, agents: [{ ...agent, state: 'stopping' }] };
            body = { outcome: 'ok' };
        }
        const text = JSON.stringify(body);
        return { ok: code < 400, status: code, text: async () => text };
    });
    global.fetch = fetchMock;
});

async function readyProject() {
    await useEditorStore.getState().refreshStatus();
    serverStatus = { outcome: 'pending', simulation_id: 'run-1', start_ts_ms: null, agents: [] };
    await useEditorStore.getState().loadSimulation();
    serverStatus = { ...serverStatus, outcome: 'ready', agents: [agent] };
    await useEditorStore.getState().refreshStatus();
}

test('load, agent acknowledgement, start, stop and drain form a guarded lifecycle', async () => {
    expect(canLoadSimulation(useEditorStore.getState())).toBe(false);
    await useEditorStore.getState().refreshStatus();
    expect(canLoadSimulation(useEditorStore.getState())).toBe(true);
    serverStatus = { outcome: 'pending', simulation_id: 'run-1', start_ts_ms: null, agents: [] };
    await useEditorStore.getState().loadSimulation();
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
    serverStatus = { ...serverStatus, outcome: 'ready', agents: [agent] };
    await useEditorStore.getState().refreshStatus();
    expect(canStartSimulation(useEditorStore.getState())).toBe(true);
    await useEditorStore.getState().launchSimulation();
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
    expect(canLoadSimulation(useEditorStore.getState())).toBe(false);
    expect(canStopSimulation(useEditorStore.getState())).toBe(true);
    await useEditorStore.getState().stopSimulation();
    expect(canLoadSimulation(useEditorStore.getState())).toBe(false);
    serverStatus.agents = [];
    await useEditorStore.getState().refreshStatus();
    expect(canLoadSimulation(useEditorStore.getState())).toBe(true);
});

test('editor changes require a new load before starting', async () => {
    await readyProject();
    useEditorStore.getState().updateScript('changed script');
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
    await expect(useEditorStore.getState().launchSimulation()).rejects.toThrow('Load this project');
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/start'))).toBe(false);
});

test('another run or an agent error cannot be mistaken for a ready project', async () => {
    await readyProject();
    serverStatus.simulation_id = 'other-run';
    await useEditorStore.getState().refreshStatus();
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
    serverStatus.simulation_id = 'run-1';
    serverStatus.agents = [{ ...agent, error: 'MQTT module unavailable' }];
    await useEditorStore.getState().refreshStatus();
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
});

test('start rechecks readiness before sending the command', async () => {
    await readyProject();
    serverStatus = { ...serverStatus, outcome: 'pending', agents: [] };
    await expect(useEditorStore.getState().launchSimulation()).rejects.toThrow('no longer ready');
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/start'))).toBe(false);
    expect(useEditorStore.getState().operation).toBeNull();
});

test('unavailable status blocks start without reporting success', async () => {
    await readyProject();
    statusCode = 503;
    serverStatus = { message: 'Controller unavailable' };
    await useEditorStore.getState().refreshStatus();
    expect(useEditorStore.getState().statusError).toBe('Controller unavailable');
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
});

test('older embedded backends still load, start and reload without status or stop', async () => {
    statusCode = 404;
    serverStatus = {};
    fetchMock.mockImplementation(async (url: string) => ({
        ok: !url.endsWith('/status'), status: url.endsWith('/status') ? 404 : 200,
        text: async () => JSON.stringify(url.endsWith('/status') ? {} : { outcome: 'ok' }),
    }));
    await useEditorStore.getState().refreshStatus();
    await useEditorStore.getState().loadSimulation();
    expect(canStartSimulation(useEditorStore.getState())).toBe(true);
    await useEditorStore.getState().launchSimulation();
    expect(canStopSimulation(useEditorStore.getState())).toBe(false);
    expect(canLoadSimulation(useEditorStore.getState())).toBe(true);
    await useEditorStore.getState().loadSimulation();
    expect(canStartSimulation(useEditorStore.getState())).toBe(true);
});

test('a controller load identifier requires live confirmation even if status returns 404', async () => {
    await readyProject();
    statusCode = 404;
    await useEditorStore.getState().refreshStatus();
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
});

test('late replies from a previous backend do not enable controls on a new backend', async () => {
    let resolve: (value: unknown) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const request = useEditorStore.getState().refreshStatus();
    useEditorStore.getState().updateConfig({ backends: [{ name: 'Other', baseUrl: 'https://other' }] });
    resolve({ ok: true, status: 200, text: async () => JSON.stringify({ outcome: 'ready', simulation_id: 'run-1', start_ts_ms: null, agents: [agent] }) });
    await request;
    expect(useEditorStore.getState().simulationStatus).toBeNull();
    expect(canStartSimulation(useEditorStore.getState())).toBe(false);
});
