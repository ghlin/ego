import { loadFromSqliteDB, parseReplay, ReplayReader } from '@ego/data-loader'
import { DuelDriver, isHostAwaitingResponse } from '@ego/duel-host'
import { CoreEngine } from '@ego/engine-interface'
import { CoreEngine as Engine, DataStore, ScriptStore } from '@ego/engine-native'
import { Message } from '@ego/message-protocol'
import { echo, echoln } from '@ego/misc'
import { lstat, readdir, readFile, writeFile } from 'fs-extra'
import { join, parse } from 'path'
import yargs from 'yargs'

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

  return messages
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
    echoln(`[init-engine] loading engine: ${args.engine}`)
    const engine = new Engine(args.engine)

    const dataStore = new DataStore()

    echoln(`[init-engine] opening database: ${args.database}`)
    const records = await loadFromSqliteDB(args.database)
    for (const record of records) {
      dataStore.add(record)
      echo(`[init-engine] add data store: ${record.name}...`)
    }
    echoln(`[init-engine] loaded ${records.length} records.`)

    const scriptStore = new ScriptStore()

    echoln(`[init-engine] loading scripts from: ${args.scripts}`)
    const files = await readdir(args.scripts)
    for (const file of files) {
      const path = join(args.scripts, file)
      const stat = await lstat(path)
      if (!stat.isFile()) { continue }
      const content = await readFile(path)
      scriptStore.add(file, content.toString())
    }

    echoln(`[init-engine] loaded ${files.length} scripts.`)

    engine.bindData(dataStore)
    engine.bindScript(scriptStore)

    for (const replay of args.batch.concat(args._) as string[]) {
      const name = parse(replay).name
      const output = join(args.outdir, `${name}.laminated.json`)
      echo(`[laminate] ${replay}...`)
      try {
        const messages = laminate(engine, await readFile(replay))
        await writeFile(output, JSON.stringify(messages, undefined, 3))
        echoln(`[laminate] ${replay} done.`)
      } catch (e) {
        console.error(e)
      }
    }
  })
  .parse()
