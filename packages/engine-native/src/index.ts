import engine from '../build/Release/enginewrapper.node'
import { DataStore, ScriptStore, CoreEngine } from '@ego/engine-interface'

const DataStore: new() => DataStore = engine.DataStore
const ScriptStore: new() => ScriptStore = engine.ScriptStore
const CoreEngine: new(sharedObjectPath: string) => CoreEngine = engine.CoreEngine

export { DataStore, ScriptStore, CoreEngine }
