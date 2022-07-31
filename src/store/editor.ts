import { handleMenuEvent } from 'handlers/menu';
import create from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface ExpressionDefinition {
  model: string,
  expression: string,
}

type EditorView = 'editor'|'chart';

interface ChartData {
  xs: number[],
  models: ModelChartData[],
}

interface ModelChartData {
  name: string,
  ys: number[],
}

interface EditorState {
  filePath: string | null,
  editorView: EditorView,
  script: string,
  expressions: ExpressionDefinition[],
  chartData: ChartData,
  handleMenuEvent: (event_id: string) => void,
  updateEditorView: (view: EditorView) => void,
  updateScript: (script: string) => void,
  updateModelName: (idx: number, model: string) => void,
  updateModelExpression: (idx: number, expr: string) => void,
  addExpression: () => void,
  remExpression: (idx: number) => void,
  fetchChartData: () => void,
}

const DEFAULT_SCRIPT = `struct Hailstone;

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

export type EditorStateGetter = () => EditorState;
export type EditorStateSetter = (stateUpdater: (state: EditorState) => EditorState) => void;

export const useEditorStore = create<EditorState>()(
  devtools(
    persist((set, get) => ({
      filePath: null,
      editorView: 'editor',
      script: DEFAULT_SCRIPT,
      expressions: [{
        model: 'Hailstone',
        expression: '10*rect(t/120)',
      }],
      chartData: {
        xs: [],
        models: [],
      },
      handleMenuEvent: async (eventId) => await handleMenuEvent(get, set, eventId),
      updateEditorView: (view) => set(state => ({...state, editorView: view})),
      updateScript: (updatedScript) => set((state) => ({...state, script: updatedScript })),
      updateModelName: (idx, name) => set(state => ({
        ...state, 
        expressions: state.expressions.map(replacer(idx, it => ({...it, model: name})))
      })),
      updateModelExpression: (idx, expression) => set(state => ({
        ...state, 
        expressions: state.expressions.map(replacer(idx, it => ({...it, expression: expression})))
      })),
      addExpression: () => set(state => { 
        const expressions = state.expressions;
        return {...state, expressions: [...expressions, { model: '', expression: '' }]}
      }),
      remExpression: (idx) => set(state => { 
        const expressions = state.expressions.filter((_, itemIdx) => itemIdx !== idx);
        return {...state, expressions}
      }),
      fetchChartData: async () => {
        const expr = get().expressions;
        const resp = await fetch('http://localhost:54321/simulation/compute_shape', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            xmax: 3600, 
            resolution: 200, 
            models: expr.reduce((acc, entry) => ({...acc, [entry.model]: entry.expression}), {}) 
          })
        });
        let parsed = await resp.json();
        set(state => ({...state, chartData: { 
          xs: parsed.x, 
          models: Object.entries(parsed.y).map(([k, v]) => ({ name: k, ys: v as number[]}))
        }}));
      }
    }))
  )
)


const replacer = <T>(idx: number, mapper: (v: T) => T) => (value: T, arrayIdx: number) => idx === arrayIdx ? mapper(value) : value;