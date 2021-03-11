import { parallel, CardRecordWithText } from '@ego/common'
import { imageFromURL, request } from '../bits/misc'
import { LaminatedReplay } from './replay'

export interface Assets {
  images: Map<number, HTMLImageElement>
  textures: {
    cover: HTMLImageElement
    unknown: HTMLImageElement
  }
  database: CardRecordWithText[]
}

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

export async function loadAssets(
  replay: LaminatedReplay,
  reportProgress?: (progress: number, total: number, rc: string) => void
): Promise<Assets> {
  const database = await request('GET', 'assets/database.json')
    .then(o => JSON.parse(o) as CardRecordWithText[])

  const marks: Set<number> = new Set()

  extractCodelike(replay.messages, marks)
  for (const p of replay.players) {
    extractCodelike({ cards: p.main }, marks)
    extractCodelike({ cards: p.extra }, marks)
  }

  const total    = marks.size + 2
  let   progress = 0

  async function downloadImage(url: string) {
    const image = await imageFromURL(url)
    if (reportProgress) {
      reportProgress(progress++, total, url)
    }
    return image
  }

  const cover   = await downloadImage(`assets/textures/cover.jpg`)
  const unknown = await downloadImage(`assets/textures/unknown.jpg`)

  const images: Map<number, HTMLImageElement> = new Map()
  await parallel(5, function *produce() {
    for (const code of marks.values()) {
      yield downloadImage(`assets/images/${code}.jpg`)
        .then(image => images.set(code, image))
    }
  })

  const textures = { cover, unknown }

  return { images, textures, database }
}
