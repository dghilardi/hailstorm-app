import { handleMenuEvent, loadSimulationFile } from 'handlers/menu';
import create from 'zustand'
import { devtools } from 'zustand/middleware'
import * as t from 'io-ts'
import { AlertColor } from '@mui/material';
import { defaultConfig, HailstormConfigType } from 'services/config';
import * as api from 'services/hailstorm';
import { ActionOutcomeType, HailstormBackendType } from 'services/hailstorm';
export { HailstormBackend } from 'services/hailstorm';
export type { ActionOutcomeType, HailstormBackendType } from 'services/hailstorm';

export const ModelExpression = t.type({
  model: t.string,
  expression: t.string,
});

export const HailstormProject = t.type({
  script: t.string,
  behaviour: t.array(ModelExpression),
})

export type HailstormProjectType = t.TypeOf<typeof HailstormProject>;

export interface SnackbarParams {
  severity: AlertColor | undefined,
  message: string,
  open: boolean,
}

interface ExpressionDefinition {
  model: string,
  expression: string,
}

type EditorView = 'editor' | 'chart';

interface ChartData {
  xs: number[],
  models: ModelChartData[],
}

interface ModelChartData {
  name: string,
  ys: number[],
}

interface EditorState {
  backends: HailstormBackendType[],
  selectedBackend: number,
  filePath: string | null,
  editorView: EditorView,
  script: string,
  expressions: ExpressionDefinition[],
  chartData: ChartData,
  snackbar: SnackbarParams,
  openSnackbar: (message: string, severity: AlertColor) => void,
  closeSnackbar: () => void,
  handleMenuEvent: (event_id: string) => void,
  loadSimulationFile: (path: string) => void,
  updateEditorView: (view: EditorView) => void,
  updateSelectedBackend: (idx: number) => void,
  updateScript: (script: string) => void,
  updateModelName: (idx: number, model: string) => void,
  updateModelExpression: (idx: number, expr: string) => void,
  addExpression: () => void,
  remExpression: (idx: number) => void,
  updateConfig: (config: HailstormConfigType) => void,
  fetchChartData: () => void,
  loadSimulation: () => Promise<ActionOutcomeType>,
  launchSimulation: () => Promise<ActionOutcomeType>,
}

const DEFAULT_SCRIPT = `use hailstorm::bot::ActionTrigger;

struct Hailstone;

impl Hailstone {
  pub fn new(args) { Self }

  pub fn register_bot(bot) {
    bot.register_action(ActionTrigger::alive(100.0), Self::do_nothing);
  }

  pub async fn do_nothing(self) {
    println("doing nothing ...")
  }
}
`;

export const DEFAULT_PROJECT: HailstormProjectType = {
  script: DEFAULT_SCRIPT,
  behaviour: [{
    model: 'Hailstone',
    expression: '10*rect(t/120)'
  }]
};

export type EditorStateGetter = () => EditorState;
export type EditorStateSetter = (stateUpdater: (state: EditorState) => EditorState) => void;

export const useEditorStore = create<EditorState>()(
  devtools((set, get) => ({
    backends: defaultConfig().backends,
    selectedBackend: 0,
    filePath: null,
    editorView: 'editor',
    script: DEFAULT_PROJECT.script,
    expressions: DEFAULT_PROJECT.behaviour,
    chartData: {
      xs: [],
      models: [],
    },
    snackbar: {
      message: '',
      severity: undefined,
      open: false,
    },
    openSnackbar: (message, severity) => set(state => {
      const snackbar = { message, severity, open: true };
      return { ...state, snackbar };
    }),
    closeSnackbar: () => set(state => {
      const snackbar = { message: state.snackbar.message, severity: state.snackbar.severity, open: false };
      return { ...state, snackbar };
    }),
    handleMenuEvent: async (eventId) => {
      try { await handleMenuEvent(get, set, eventId); }
      catch (error) { get().openSnackbar(error instanceof Error ? error.message : String(error), 'error'); }
    },
    loadSimulationFile: async (path) => await loadSimulationFile(path, false, get, set),
    updateEditorView: (view) => set(state => ({ ...state, editorView: view })),
    updateSelectedBackend: (idx: number) => set(state => ({ ...state, selectedBackend: idx })),
    updateScript: (updatedScript) => set((state) => ({ ...state, script: updatedScript })),
    updateModelName: (idx, name) => set(state => ({
      ...state,
      expressions: state.expressions.map(replacer(idx, it => ({ ...it, model: name })))
    })),
    updateModelExpression: (idx, expression) => set(state => ({
      ...state,
      expressions: state.expressions.map(replacer(idx, it => ({ ...it, expression: expression })))
    })),
    addExpression: () => set(state => {
      const expressions = state.expressions;
      return { ...state, expressions: [...expressions, { model: '', expression: '' }] }
    }),
    remExpression: (idx) => set(state => {
      const expressions = state.expressions.filter((_, itemIdx) => itemIdx !== idx);
      return { ...state, expressions }
    }),
    updateConfig: (config) => set(state => ({ ...state, backends: config.backends, selectedBackend: 0 })),
    fetchChartData: async () => {
      const expr = get().expressions;
      const backend = get().backends[get().selectedBackend];
      const parsed = await api.computeShape(backend, expr.reduce((acc, entry) => ({ ...acc, [entry.model]: entry.expression }), {}));
      set(state => ({
        ...state, chartData: {
          xs: parsed.x,
          models: Object.entries(parsed.y).map(([k, v]) => ({ name: k, ys: v as number[] }))
        }
      }));
    },
    loadSimulation: async () => {
      const script = get().script;
      const users = get().expressions.map(({ model, expression }) => ({ model, shape: expression }));
      const backend = get().backends[get().selectedBackend];
      return api.loadSimulation(backend, script, users);
    },
    launchSimulation: async () => {
      const backend = get().backends[get().selectedBackend];
      return api.startSimulation(backend);
    },
  }))
)


const replacer = <T>(idx: number, mapper: (v: T) => T) => (value: T, arrayIdx: number) => idx === arrayIdx ? mapper(value) : value;