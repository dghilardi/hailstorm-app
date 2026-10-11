import { ApiError, backendUrl, computeShape, HailstormBackend, loadSimulation, startSimulation } from './hailstorm';

const backend = { name: 'Controller', baseUrl: '' };
const fetchMock = jest.fn();

function reply(body: unknown, status = 200) {
    fetchMock.mockResolvedValueOnce({ ok: status < 400, status, text: async () => JSON.stringify(body) });
}

beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
});

test('loads a controller simulation using the returned run identifier', async () => {
    reply({ simulation_id: 'run-7' });
    const users = [{ model: 'Bot', shape: '10' }];
    await expect(loadSimulation(backend, 'struct Bot;', users)).resolves.toEqual({ outcome: 'ok', simulation_id: 'run-7' });
    expect(fetchMock).toHaveBeenCalledWith('/hailstorm/simulation/load', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ script: 'struct Bot;', users }),
    }));
});

test('retains compatibility with the embedded load and start responses', async () => {
    reply({ outcome: 'ok' });
    reply({ outcome: 'ok' });
    const embedded = { name: 'Embedded', hostname: 'localhost', port: 54321 };
    await expect(loadSimulation(embedded, '', [])).resolves.toEqual({ outcome: 'ok' });
    await expect(startSimulation(embedded)).resolves.toEqual({ outcome: 'ok' });
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:54321/hailstorm/simulation/start');
});

test('accepts old desktop config and explicit HTTPS backend URLs', () => {
    expect(HailstormBackend.is({ name: 'Remote', hostname: 'host', port: 443 })).toBe(true);
    expect(backendUrl({ name: 'Remote', hostname: 'host', port: 443, protocol: 'https' })).toBe('https://host:443');
    expect(backendUrl({ name: 'Remote', baseUrl: 'https://host/proxy/' })).toBe('https://host/proxy');
});

test('rejects HTTP errors even when the body resembles a successful operation', async () => {
    reply({ outcome: 'ok', message: 'No simulation is loaded' }, 409);
    await expect(startSimulation(backend)).rejects.toThrow('No simulation is loaded');
});

test('rejects malformed success responses', async () => {
    reply({ other: 'field' });
    await expect(loadSimulation(backend, '', [])).rejects.toBeInstanceOf(ApiError);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '<html>Login</html>' });
    await expect(startSimulation(backend)).rejects.toThrow('invalid JSON');
});

test('computes planned shapes through the selected backend', async () => {
    reply({ x: [0, 1], y: { Bot: [10, 10] } });
    await expect(computeShape(backend, { Bot: '10' })).resolves.toEqual({ x: [0, 1], y: { Bot: [10, 10] } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).models).toEqual({ Bot: '10' });
});
