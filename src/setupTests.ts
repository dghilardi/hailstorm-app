import '@testing-library/jest-dom';

jest.mock('@tauri-apps/api/fs', () => ({
    BaseDirectory: { Config: 11 }, readTextFile: jest.fn(), writeTextFile: jest.fn(), createDir: jest.fn(),
}));
jest.mock('@tauri-apps/api/dialog', () => ({ save: jest.fn(), open: jest.fn(), ask: jest.fn() }));
jest.mock('@tauri-apps/api/cli', () => ({ getMatches: jest.fn() }));
jest.mock('@tauri-apps/api/event', () => ({ listen: jest.fn() }));
