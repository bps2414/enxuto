/** One tool call of the turn in flight (or the last one), as the digest and the pane read it. */
export type Call = {
  id: string
  tool: string
  /** what it was about: the call's own description, else the file, pattern or command */
  what: string
  ms: number
  isDone: boolean
  isError: boolean
}

declare module 'claude-code' {
  interface PluginState {
    enxuto: {
      /** `curto`: the model is asked for short whole replies; `inteiro`: replies as they come; `dobra`: long replies fold */
      mode: string
      /** tool rows drawn as one colored line each, their results hidden */
      isLean: boolean
      calls: Call[]
      /** a long reply the person opened or shut by hand: `open`, `shut`, or `` for the mode's default */
      view: StateFamily<string>
      theme: string
      lastMs: number
      lastAnswer: string
    }
  }
}
