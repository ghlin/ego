import { CardRecordWithText } from '@ego/engine-interface'
import * as sqlite from 'sqlite'

const strs = [...new Array(16)].map((_, v) => `str${v + 1}`)

/**
 * load card records from cards.cdb
 */
export async function loadFromSqliteDB(path: string) {
  const sqliteDB = await sqlite.open(path, { promise: Promise })
  const sql = `
    SELECT
      datas.id as code,
      alias,
      type,
      level,
      attribute,
      race,
      atk as attack,
      def as defense,
      printf("%d", setcode) as setcode, -- to string.
      texts.name as name,
      texts.desc as description,
      ${
        strs.map(s => `texts.${s} as ${s}`).join(',')
      }
    FROM datas, texts
    WHERE datas.id = texts.id
  `
  return sqliteDB.all(sql).then(records => records.map(mkRecord))
}

type RecordFromCDB = Omit<CardRecordWithText, 'texts' | 'setcode' | 'link_marker'>

function mkRecord(r: RecordFromCDB): CardRecordWithText {
  const level = r.level & 0xFF
  const lscale = (r.level >> 24) & 0xFF
  const rscale = (r.level >> 16) & 0xFF

  const TYPE_LINK = 0x000004000000

  const defense = (r.type & TYPE_LINK) ? 0 : r.defense
  const markers = (r.type & TYPE_LINK) ? r.defense : 0
  const texts = strs.map(k => (r as any)[k]).filter(v => !!v) as string[]
  const card: any = { ...r, level, lscale, rscale, defense, link_marker: markers, texts }
  card.texts = strs.map(k => card[k]).filter(t => t && t.length)
  for (const k of strs) {
    delete card[k]
  }

  return card
}
