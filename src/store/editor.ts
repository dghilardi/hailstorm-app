import create from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface EditorState {
  script: string,
  updateScript: (script: string) => void
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
      updateScript: (updatedScript) => set((state) => ({...state, script: updatedScript })),
    }))
  )
)
