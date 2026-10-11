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

export interface EditorState {
  backends: HailstormBackendType[],
  selectedBackend: number,
  filePath: string | null,
  editorView: EditorView,
  script: string,
  expressions: ExpressionDefinition[],
  chartData: ChartData,
  snackbar: SnackbarParams,
  simulationStatus: api.SimulationStatusType | null,
  statusSupported: boolean | null,
  statusError: string | null,
  loadedProject: string | null,
  loadedSimulationId: string | null,
  legacyPhase: 'idle' | 'ready' | 'running',
  operation: 'load' | 'start' | 'stop' | null,
  backendEpoch: number,
  runEpoch: number,
  openSnackbar: (message: string, severity: AlertColor) => void,
  closeSnackbar: () => void,
  handleMenuEvent: (event_id: string) => void,
  loadSimulationFile: (path: string) => Promise<void>,
  updateEditorView: (view: EditorView) => void,
  updateSelectedBackend: (idx: number) => void,
  updateScript: (script: string) => void,
  updateModelName: (idx: number, model: string) => void,
  updateModelExpression: (idx: number, expr: string) => void,
  addExpression: () => void,
  remExpression: (idx: number) => void,
  updateConfig: (config: HailstormConfigType) => void,
  fetchChartData: () => Promise<void>,
  loadSimulation: () => Promise<ActionOutcomeType>,
  launchSimulation: () => Promise<ActionOutcomeType>,
  stopSimulation: () => Promise<ActionOutcomeType>,
  refreshStatus: () => Promise<void>,
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
    simulationStatus: null,
    statusSupported: null,
    statusError: null,
    loadedProject: null,
    loadedSimulationId: null,
    legacyPhase: 'idle',
    operation: null,
    backendEpoch: 0,
    runEpoch: 0,
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
    updateSelectedBackend: (idx: number) => set(state => ({ ...state, selectedBackend: idx, ...resetBackend(state) })),
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
    updateConfig: (config) => set(state => ({ ...state, backends: config.backends, selectedBackend: 0, ...resetBackend(state) })),
    fetchChartData: async () => {
      const expr = get().expressions;
      const backend = get().backends[get().selectedBackend];
      const parsed = await api.computeShape(backend, expr.reduce((acc, entry) => ({ ...acc, [entry.model]: entry.expression }), {}));
      if (backend !== get().backends[get().selectedBackend] || expr !== get().expressions) return;
      set(state => ({
        ...state, chartData: {
          xs: parsed.x,
          models: Object.entries(parsed.y).map(([k, v]) => ({ name: k, ys: v as number[] }))
        }
      }));
    },
    loadSimulation: async () => {
      if (!canLoadSimulation(get())) throw new Error('Stop the current simulation before loading another project.');
      const epoch = get().backendEpoch;
      const project = projectSnapshot(get());
      const script = get().script;
      const users = get().expressions.map(({ model, expression }) => ({ model, shape: expression }));
      const backend = get().backends[get().selectedBackend];
      set(state => ({ ...state, operation: 'load', runEpoch: state.runEpoch + 1, loadedProject: null, loadedSimulationId: null }));
      try {
        const result = await api.loadSimulation(backend, script, users);
        if (epoch !== get().backendEpoch) return result;
        set(state => ({ ...state, loadedProject: project, loadedSimulationId: result.simulation_id || null, legacyPhase: 'ready', simulationStatus: null }));
        await get().refreshStatus();
        return result;
      } finally {
        if (epoch === get().backendEpoch) set(state => ({ ...state, operation: null }));
      }
    },
    launchSimulation: async () => {
      if (!canStartSimulation(get())) throw new Error('Load this project and wait for all agents to be ready.');
      const epoch = get().backendEpoch;
      const backend = get().backends[get().selectedBackend];
      set(state => ({ ...state, operation: 'start', runEpoch: state.runEpoch + 1 }));
      try {
        await get().refreshStatus();
        if (epoch !== get().backendEpoch || !canStartSimulation(get(), true)) throw new Error('The simulation is no longer ready. Reload the project or check the agents.');
        const result = await api.startSimulation(backend);
        if (epoch !== get().backendEpoch) return result;
        set(state => ({ ...state, legacyPhase: 'running', simulationStatus: null }));
        await get().refreshStatus();
        return result;
      } finally {
        if (epoch === get().backendEpoch) set(state => ({ ...state, operation: null }));
      }
    },
    stopSimulation: async () => {
      if (!canStopSimulation(get())) throw new Error('There is no active simulation to stop.');
      const epoch = get().backendEpoch;
      const backend = get().backends[get().selectedBackend];
      set(state => ({ ...state, operation: 'stop', runEpoch: state.runEpoch + 1 }));
      try {
        const result = await api.stopSimulation(backend);
        if (epoch !== get().backendEpoch) return result;
        set(state => ({ ...state, loadedProject: null, loadedSimulationId: null, legacyPhase: 'idle', simulationStatus: null }));
        await get().refreshStatus();
        return result;
      } finally {
        if (epoch === get().backendEpoch) set(state => ({ ...state, operation: null }));
      }
    },
    refreshStatus: async () => {
      const epoch = get().backendEpoch;
      const runEpoch = get().runEpoch;
      const backend = get().backends[get().selectedBackend];
      try {
        const status = await api.simulationStatus(backend);
        if (epoch !== get().backendEpoch || runEpoch !== get().runEpoch) return;
        set(state => ({ ...state, simulationStatus: status, statusSupported: status !== null, statusError: null }));
      } catch (error) {
        if (epoch !== get().backendEpoch || runEpoch !== get().runEpoch) return;
        set(state => ({ ...state, statusError: error instanceof Error ? error.message : String(error) }));
      }
    },
  }))
)


const replacer = <T>(idx: number, mapper: (v: T) => T) => (value: T, arrayIdx: number) => idx === arrayIdx ? mapper(value) : value;

function projectSnapshot(state: EditorState): string {
  return JSON.stringify({ script: state.script, behaviour: state.expressions });
}

function resetBackend(state: EditorState) {
  return { simulationStatus: null, statusSupported: null, statusError: null, loadedProject: null, loadedSimulationId: null, legacyPhase: 'idle' as const, operation: null, backendEpoch: state.backendEpoch + 1, runEpoch: 0 };
}

export function canStartSimulation(state: EditorState, ignoreOperation = false): boolean {
  if ((!ignoreOperation && state.operation) || state.statusError || state.loadedProject !== projectSnapshot(state)) return false;
  if (state.statusSupported === false) return state.loadedSimulationId === null && state.legacyPhase === 'ready';
  const status = state.simulationStatus;
  return !!status && status.outcome === 'ready' && status.start_ts_ms === null
    && !!state.loadedSimulationId && status.simulation_id === state.loadedSimulationId
    && status.agents.length > 0 && status.agents.every(agent => agent.state === 'ready' && agent.simulation_id === state.loadedSimulationId && !agent.error);
}

export function canLoadSimulation(state: EditorState): boolean {
  if (state.operation || state.statusError || state.statusSupported === null) return false;
  if (state.statusSupported === false) return true;
  const status = state.simulationStatus;
  return !!status && ((status.outcome === 'idle' || status.outcome === 'ready' || status.outcome === 'failed')
    && !status.agents.some(agent => ['running', 'waiting', 'stopping'].includes(agent.state)));
}

export function canStopSimulation(state: EditorState): boolean {
  return !state.operation && state.statusSupported === true
    && (!!state.simulationStatus?.simulation_id || (!state.simulationStatus && state.legacyPhase === 'running'));
}
