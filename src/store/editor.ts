import { isMetaProperty } from 'typescript';
import create from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface ExpressionDefinition {
  model: string,
  expression: string,
}

interface EditorState {
  script: string,
  expressions: ExpressionDefinition[],
  updateScript: (script: string) => void,
  updateModelName: (idx: number, model: string) => void,
  updateModelExpression: (idx: number, expr: string) => void,
  addExpression: () => void,
  remExpression: (idx: number) => void,
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

export const useEditorStore = create<EditorState>()(
  devtools(
    persist((set) => ({
      script: DEFAULT_SCRIPT,
      expressions: [{
        model: 'Hailstone',
        expression: '10*rect(t/120)',
      }],
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
      })
    }))
  )
)


const replacer = <T>(idx: number, mapper: (v: T) => T) => (value: T, arrayIdx: number) => idx === arrayIdx ? mapper(value) : value;