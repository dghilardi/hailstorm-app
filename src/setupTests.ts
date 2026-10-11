import '@testing-library/jest-dom';

jest.mock('@tauri-apps/plugin-fs', () => ({
    BaseDirectory: { Config: 11 }, readTextFile: jest.fn(), writeTextFile: jest.fn(), mkdir: jest.fn(),
}));
jest.mock('@tauri-apps/plugin-dialog', () => ({ save: jest.fn(), open: jest.fn(), ask: jest.fn() }));
jest.mock('@tauri-apps/plugin-cli', () => ({ getMatches: jest.fn() }));
jest.mock('@tauri-apps/api/event', () => ({ listen: jest.fn() }));
jest.mock('@tauri-apps/api/core', () => ({ isTauri: () => !!(globalThis as any).isTauri }));
