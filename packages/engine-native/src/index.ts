// import engine from '../build/Release/enginewrapper.node'
import { DataStore, ScriptStore, CoreEngine } from '@ego/engine-interface'

let engine: any

try {
  // tslint:disable-next-line
  engine = require('../build/Release/enginewrapper.node')
} catch (e) {
  console.error(`Error loading engine ${e}, try loading debug build.`)

  // tslint:disable-next-line
  engine = require('../build/Debug/enginewrapper.node')
}

const DataStore: new() => DataStore = engine.DataStore
const ScriptStore: new() => ScriptStore = engine.ScriptStore
const CoreEngine: new(sharedObjectPath: string) => CoreEngine = engine.CoreEngine

export { DataStore, ScriptStore, CoreEngine }
