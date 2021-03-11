import { CardRecordWithText } from '@ego/common'
import { loadFromSqliteDB, parseReplay, ReplayReader } from '@ego/data-loader'
import { DuelDriver, isHostAwaitingResponse } from '@ego/duel-host'
import { CoreEngine } from '@ego/engine-interface'
import { CoreEngine as Engine, DataStore, ScriptStore } from '@ego/engine-native'
import { Message } from '@ego/message-protocol'
import { lstat, readdir, readFile, writeFile } from 'fs-extra'
import { join, parse } from 'path'
import yargs from 'yargs'

function extractCodelike(m: any, marks: Set<number>) {
  function walk(o: any, key: string) {
    if (Array.isArray(o)) {
      for (const v of o) { walk(v, key) }
    } else if (typeof o === 'number') {
      if (key.includes('code') || key.includes('card')) {
        marks.add(o)
      }
    } else if (typeof o === 'object') {
      for (const k of Object.keys(o)) { walk(o[k], k) }
    }
  }

  walk(m, '')
}

type Database = Record<number, CardRecordWithText>
export function laminate(core: CoreEngine, data: Buffer) {
  const reader = new ReplayReader(parseReplay(data))
  const responses = reader.responses()
  const duel = new DuelDriver(core, {
    lp: reader.replay.lp,
    draw: reader.replay.draw,
    start: reader.replay.hand,
    seed: reader.seed(),
    players: reader.replay.players,
    engineOptions: reader.replay.options
  })

  const messages: Message[] = []

  let next = 0
  try {
    retry:
    while (true) {
      const steps = duel.step()
      for (const step of steps) {
        if (step.tag === 'HOST_ERROR') { throw step.what }
        if (step.tag === 'HOST_DUEL_FINISHED') { break retry }
        messages.push(step.what)

        if (isHostAwaitingResponse(step)) {
          if (next >= responses.length) {
            // One surrendered.
            break retry
          }

          if (!duel.feed(responses[next])) {
            console.warn(`[laminate]: responses.length = ${responses.length}, next = ${next}`)
            throw new Error(`ReplayError: replay responses not all consumed (${next}/${responses.length})`)
          }

          ++next
        }
      }
    }
  } finally {
    duel.release()
  }

  const marks: Set<number> = new Set()
  extractCodelike(messages, marks)
  for (const p of reader.replay.players) {
    extractCodelike({ cards: p.main }, marks)
    extractCodelike({ cards: p.extra }, marks)
  }

  return { players: reader.replay.players, messages }
}

yargs.command(
  '$0 [replays]',
  'expand replay file.',
  y => y
    .option('engine', { type: 'string', alias: 'e', demandOption: true, desc: 'path of libocgcore.so' })
    .option('database', { type: 'string', alias: 'd', demandOption: true, desc: 'path of cards.cdb' })
    .option('scripts', { type: 'string', alias: 's', demandOption: true, desc: 'directory of card scripts' })
    .option('outdir', { type: 'string', demandOption: true, desc: 'output directory' })
    .option('batch', { type: 'array', demandOption: true, desc: 'input files' })
    .positional('replays', { alias: 'batch' }),
  async args => {
    // init engine.
    console.log(`[init-engine] loading engine: ${args.engine}`)
    const engine = new Engine(args.engine)

    const dataStore = new DataStore()
    const db: Database = {}

    console.log(`[init-engine] opening database: ${args.database}`)
    const records = await loadFromSqliteDB(args.database)
    for (const record of records) {
      dataStore.add(record)
      db[record.code] = record
      console.log(`[init-engine] add data store: ${record.name}...`)
    }
    console.log(`[init-engine] loaded ${records.length} records.`)

    const scriptStore = new ScriptStore()

    console.log(`[init-engine] loading scripts from: ${args.scripts}`)
    const files = await readdir(args.scripts)
    for (const file of files) {
      const path = join(args.scripts, file)
      const stat = await lstat(path)
      if (!stat.isFile()) { continue }
      const content = await readFile(path)
      scriptStore.add(file, content.toString())
    }

    console.log(`[init-engine] loaded ${files.length} scripts.`)

    engine.bindData(dataStore)
    engine.bindScript(scriptStore)

    for (const replay of args.batch.concat(args._) as string[]) {
      const name = parse(replay).name
      const output = join(args.outdir, `${name}.laminated.json`)
      console.log(`[laminate] ${replay}...`)
      try {
        const data = laminate(engine, await readFile(replay))
        await writeFile(output, JSON.stringify(data, undefined, 0))
        console.log(`[laminate] ${replay} done.`)
      } catch (e) {
        console.error(e)
      }
    }
  })
  .parse()
