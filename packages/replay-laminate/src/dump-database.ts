import { loadFromSqliteDB } from '@ego/data-loader'
import * as Y from 'yargs'
import { writeFile } from 'fs-extra'

Y.command(
  '$0 [database]',
  'dump databse to json',
  y => y.positional('databse', {
    alias: 'd',
    type: 'string',
    demandOption: true
  }),
  async args => {
    const records = await loadFromSqliteDB(args.databse)
    await writeFile('database.json', JSON.stringify(records))
  }).parse(process.argv)

