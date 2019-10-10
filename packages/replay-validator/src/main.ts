import { loadFromSqliteDB } from '@ego/data-loader'
import { CoreEngine, DataStore, ScriptStore } from '@ego/engine-native'
import { echo, echoln } from '@ego/misc'
import { lstat, readdir, readFile, writeFile } from 'fs-extra'
import { join } from 'path'
import yargs from 'yargs'
import { Validator } from './validator'

interface CommandlineOptions {
  /**
   * core path.
   */
  c: string

  /**
   * script dir.
   */
  s: string

  /**
   * cdb path
   */
  d: string

  /**
   * replay dir.
   */
  r: string
}

function getOpts(argv: string[]): CommandlineOptions {
  return yargs.option({
    c: { type: 'string', alias: 'core', demandOption: true, description: 'path to libocgcore.so' },
    d: { type: 'string', alias: 'cdb', demandOption: true, description: 'path to cards.cdb file' },
    s: { type: 'string', alias: 'script', demandOption: true, description: 'directory contains cards scripts' },
    r: { type: 'string', alias: 'replay', demandOption: true, description: 'directory contains replay files' }
  }).parse(argv)
}

async function initEntine(opts: Pick<CommandlineOptions, 'c' | 's' | 'd'>) {
  const core = new CoreEngine(opts.c)
  const dataStore = new DataStore()
  const scriptStore = new ScriptStore()
  core.bindData(dataStore)
  core.bindScript(scriptStore)

  const records = await loadFromSqliteDB(opts.d)
  for (const record of records) {
    dataStore.add(record)
    echo(`[init-engine]: add data store: ${record.name}`)
  }
  echoln(`[init-engine]: add data store done.`)

  const files = await readdir(opts.s)
  for (const file of files) {
    const path = join(opts.s, file)
    const stat = await lstat(path)
    if (!stat.isFile()) { continue }
    const content = await readFile(path)
    scriptStore.add(file, content.toString())
    echo(`[init-engine]: add script store: ${file} [${(stat.size / 1024).toFixed(2)} KiB]`)
  }
  echoln(`[init-engine]: add script store done.`)
  echoln(`[init-engine]: done. ${records.length} records, ${files.length} scripts`)

  return { core, dataStore, scriptStore }
}

async function main(argv: string[]) {
  const now = new Date().toLocaleDateString().replace(/\//g, '_')
  const dumpfile = `replay-validate.${now}.txt`
  await writeFile(dumpfile, `---`)
  const opts = getOpts(argv)
  const engine = await initEntine(opts)
  const validator = new Validator(engine.core)
  const files = await readdir(opts.r)
  const goodies: string[] = []
  const naughties: string[] = []
  for (let i = 0; i !== files.length; ++i) {
    const file = files[i]
    const path = join(opts.r, file)
    const stat = await lstat(path)
    if (!stat.isFile()) { continue }
    const content = await readFile(path)
    echo(`[validate] ${(i + 1).toString().padStart(4)} / ${files.length} - validating ${file} [${(stat.size / 1024).toFixed(2)} KiB]...`)
    try {
      const messages = validator.validate(content)
      goodies.push(file)
      echoln(`[validate] ${file} passed! ${messages.length} messages`)
    } catch (error) {
      naughties.push(file)
      echoln(`[validate] ${file} failed: ${error}`)
    }
  }
  await writeFile(dumpfile, `Goodies:\n${goodies.join('\n')}\n\nNaughties:\n${naughties.join('\n')}`)
  echoln(`[bye] see ${dumpfile}.`)
}

main(process.argv)
