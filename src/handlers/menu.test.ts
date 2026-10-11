import { useEditorStore } from 'store/editor';
import { confirmSave, openProject, saveProject } from 'services/platform';
import { parse } from 'yaml';

jest.mock('services/platform', () => ({
    ...jest.requireActual('services/platform'),
    confirmSave: jest.fn(), openProject: jest.fn(), saveProject: jest.fn(),
}));
const initial = useEditorStore.getState();

beforeEach(() => useEditorStore.setState(initial, true));

test('imports and exports the same HSP script and load curves', async () => {
    const project = { script: 'struct Custom;', behaviour: [{ model: 'Custom', expression: '20*rect(t/60)' }] };
    (openProject as jest.Mock).mockResolvedValue({ path: 'custom.hsp', content: JSON.stringify(project) });
    (confirmSave as jest.Mock).mockResolvedValue(false);
    (saveProject as jest.Mock).mockResolvedValue('custom.hsp');
    await useEditorStore.getState().handleMenuEvent('open');
    expect(useEditorStore.getState().script).toBe(project.script);
    expect(useEditorStore.getState().expressions).toEqual(project.behaviour);
    await useEditorStore.getState().handleMenuEvent('save');
    expect(parse((saveProject as jest.Mock).mock.calls[0][0])).toEqual(project);
});

test('invalid projects leave the editor intact and show an error', async () => {
    (openProject as jest.Mock).mockResolvedValue({ path: 'invalid.hsp', content: 'script: 42' });
    await useEditorStore.getState().handleMenuEvent('open');
    expect(useEditorStore.getState().script).toBe(initial.script);
    expect(useEditorStore.getState().snackbar.severity).toBe('error');
});

test('canceling a save before New preserves the current project', async () => {
    useEditorStore.getState().updateScript('unsaved script');
    (confirmSave as jest.Mock).mockResolvedValue(true);
    (saveProject as jest.Mock).mockResolvedValue(null);
    await useEditorStore.getState().handleMenuEvent('new');
    expect(useEditorStore.getState().script).toBe('unsaved script');
});

test('canceling Import or Save As preserves the selected filename', async () => {
    useEditorStore.setState({ filePath: 'original.hsp' });
    (openProject as jest.Mock).mockResolvedValue(null);
    (saveProject as jest.Mock).mockResolvedValue(null);
    await useEditorStore.getState().handleMenuEvent('open');
    await useEditorStore.getState().handleMenuEvent('save-as');
    expect(useEditorStore.getState().filePath).toBe('original.hsp');
});
