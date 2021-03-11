import { CardRecord } from '@ego/common'

export interface DataStore {
  add(card: CardRecord): void
  get(code: number): DataStore | undefined
  keys(): number []
}

export interface ScriptStore {
  add(filename: string, content: string): void
}

export interface CoreEngine {
  createDuel(seed: number): number
  startDuel(duel: number, options: number): void
  endDuel(duel: number): void
  setPlayerInfo(duel: number, info: { player: number, lp: number, start: number, draw: number }): void
  process(duel: number): [ArrayBuffer, number]
  newCard(duel: number, card: { code: number, owner: number, player: number, location: number, sequence: number, position: number }): void
  queryCard(duel: number, query: { player: number, location: number, flags: number, sequence: number, cache: boolean }): ArrayBuffer
  queryFieldCount(duel: number, query: { player: number, location: number }): number
  queryFieldCard(duel: number, query: { player: number, location: number, flags: number, cache: boolean }): ArrayBuffer
  setResponse(duel: number, response: ArrayBuffer): void
  bindData(dataStore: DataStore): void
  bindScript(scriptStore: ScriptStore): void
}

export class MonoEngine {
  constructor(
    public readonly core: CoreEngine,
    public readonly dataStore: DataStore,
    public readonly scriptStore: ScriptStore
  ) {
    core.bindScript(scriptStore)
    core.bindData(dataStore)
  }
}
