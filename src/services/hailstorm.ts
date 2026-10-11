import * as t from 'io-ts';

export const HailstormBackend = t.intersection([
    t.type({ name: t.string }),
    t.union([
        t.type({ baseUrl: t.string }),
        t.intersection([
            t.type({ hostname: t.string, port: t.number }),
            t.partial({ protocol: t.union([t.literal('http'), t.literal('https')]) }),
        ]),
    ]),
]);
export type HailstormBackendType = t.TypeOf<typeof HailstormBackend>;

export interface ActionOutcomeType {
    outcome: 'ok' | 'error';
    message?: string;
    simulation_id?: string;
}

export function backendUrl(backend: HailstormBackendType): string {
    return 'baseUrl' in backend
        ? backend.baseUrl.replace(/\/+$/, '')
        : `${backend.protocol || 'http'}://${backend.hostname}:${backend.port}`;
}

export class ApiError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'ApiError';
    }
}

async function request(backend: HailstormBackendType, path: string, body?: unknown, method = 'POST'): Promise<unknown> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(`${backendUrl(backend)}/hailstorm/${path}`, {
            method,
            signal: controller.signal,
            ...(body !== undefined ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            } : {}),
        });
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch {
            throw new ApiError(response.ok ? 'The backend returned invalid JSON.' : `HTTP ${response.status}: ${text || response.statusText}`, response.status);
        }
        if (!response.ok) {
            const message = data?.message || data?.error?.message;
            throw new ApiError(typeof message === 'string' ? message : `HTTP ${response.status}: ${text}`, response.status);
        }
        return data;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new ApiError('The backend did not respond within 10 seconds.');
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
}

function decode<A>(codec: t.Type<A>, data: unknown): A {
    const result = codec.decode(data);
    if (result._tag === 'Left') throw new ApiError('The backend returned an unexpected response.');
    return result.right;
}

const LoadResponse = t.union([
    t.type({ simulation_id: t.string }),
    t.type({ outcome: t.literal('ok') }),
]);
const OperationResponse = t.type({ outcome: t.literal('ok') });
const ShapeResponse = t.type({ x: t.array(t.number), y: t.record(t.string, t.array(t.number)) });
const SimulationStatus = t.type({
    outcome: t.keyof({ idle: null, pending: null, ready: null, running: null, failed: null }),
    simulation_id: t.union([t.string, t.null]),
    start_ts_ms: t.union([t.number, t.null]),
    agents: t.array(t.type({
        agent_id: t.number,
        state: t.string,
        simulation_id: t.string,
        error: t.union([t.string, t.null]),
        last_update_ms: t.number,
    })),
});
export type SimulationStatusType = t.TypeOf<typeof SimulationStatus>;

export async function loadSimulation(backend: HailstormBackendType, script: string, users: { model: string, shape: string }[]): Promise<ActionOutcomeType> {
    const response = decode(LoadResponse, await request(backend, 'simulation/load', { script, users }));
    return { outcome: 'ok', ...('simulation_id' in response ? { simulation_id: response.simulation_id } : {}) };
}

export async function startSimulation(backend: HailstormBackendType): Promise<ActionOutcomeType> {
    return decode(OperationResponse, await request(backend, 'simulation/start'));
}

export async function computeShape(backend: HailstormBackendType, models: Record<string, string>) {
    return decode(ShapeResponse, await request(backend, 'shape/compute', { xmax: 3600, resolution: 200, models }));
}

export async function stopSimulation(backend: HailstormBackendType): Promise<ActionOutcomeType> {
    return decode(OperationResponse, await request(backend, 'simulation/stop'));
}

export async function simulationStatus(backend: HailstormBackendType): Promise<SimulationStatusType | null> {
    try {
        return decode(SimulationStatus, await request(backend, 'simulation/status', undefined, 'GET'));
    } catch (error) {
        if (error instanceof ApiError && (error.status === 404 || error.status === 405)) return null;
        throw error;
    }
}
