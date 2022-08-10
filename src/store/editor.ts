import { handleMenuEvent, loadSimulationFile } from 'handlers/menu';
import create from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import * as t from 'io-ts'
import { AlertColor } from '@mui/material';
import { fold } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import { HailstormConfigType } from 'services/config';

export const ModelExpression = t.type({
  model: t.string,
  expression: t.string,
});

export const HailstormProject = t.type({
  script: t.string,
  behaviour: t.array(ModelExpression),
})

export type HailstormProjectType = t.TypeOf<typeof HailstormProject>;

export const ActionOutcome = t.intersection([
  t.type({
    outcome: t.string
  }),
  t.partial({
    message: t.string,
  })
]);

export type ActionOutcomeType = t.TypeOf<typeof ActionOutcome>;

export interface SnackbarParams {
  severity: AlertColor | undefined,
  message: string,
  open: boolean,
}

export const HailstormBackend = t.type({
  name: t.string,
  hostname: t.string,
  port: t.number,
});

export type HailstormBackendType = t.TypeOf<typeof HailstormBackend>;

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
    backends: [{
      name: 'Embedded',
      hostname: 'localhost',
      port: 54321,
    }],
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
    handleMenuEvent: async (eventId) => await handleMenuEvent(get, set, eventId),
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
    updateConfig: (config) => set(state => ({ ...state, backends: config.backends })),
    fetchChartData: async () => {
      const expr = get().expressions;
      const backend = get().backends[get().selectedBackend];
      const resp = await fetch(`http://${backend.hostname}:${backend.port}/hailstorm/shape/compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xmax: 3600,
          resolution: 200,
          models: expr.reduce((acc, entry) => ({ ...acc, [entry.model]: entry.expression }), {})
        })
      });
      let parsed = await resp.json();
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
      const resp = await fetch(`http://${backend.hostname}:${backend.port}/hailstorm/simulation/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script,
          users,
        })
      });
      let respObj = await resp.json();
      return pipe(ActionOutcome.decode(respObj), fold(e => ({ outcome: 'error', message: `parsing error` }), ok => ok));
    },
    launchSimulation: async () => {
      const backend = get().backends[get().selectedBackend];
      const resp = await fetch(`http://${backend.hostname}:${backend.port}/hailstorm/simulation/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      let respObj = await resp.json();
      return pipe(ActionOutcome.decode(respObj), fold(e => ({ outcome: 'error', message: `parsing error` }), ok => ok));
    },
  }))
)


const replacer = <T>(idx: number, mapper: (v: T) => T) => (value: T, arrayIdx: number) => idx === arrayIdx ? mapper(value) : value;