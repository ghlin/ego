import * as iconv from 'iconv-lite'
// tslint:disable-next-line
const { decompress } = require('lzma')
// tslint:disable-next-line
const MT = require('mersennetwister')

export interface ReplayData {
  id: number
  version: number
  seed: number
  flag: number
  hash: number
  lp: number
  hand: number
  draw: number
  options: number
  players: Array<{
    name: string
    main: number[]
    extra: number[]
  }>
  responses: Buffer
}

export class ReplayReader {
  constructor(readonly replay: ReplayData) { }

  tag() {
    return !!(this.replay.flag & REPLAY.TAG)
  }

  when() {
    return new Date(this.replay.seed * 1000)
  }

  /**
   * the actual seed to create a duel.
   */
  seed(): number {
    const mt = new MT()
    mt.seed(this.replay.seed)
    return mt.int()
  }

  /**
   * users' responses
   */
  responses() {
    const resps: Buffer[] = []
    const reader = new BufferReader(this.replay.responses)
    while (!reader.noMore()) {
      resps.push(reader.slice(reader.nextU8()))
    }
    return resps
  }
}

export function parseReplay(content: Buffer) {
  return doReadReplay(new BufferReader(content))
}

function fromCompressed(props: number[], sizes: number[], data: Buffer) {
  const header = Buffer.from(
    props.slice(0, 5).concat(sizes).concat([0, 0, 0, 0])
  )
  return Buffer.from(decompress(Buffer.concat([header, data])))
}

function translate(name: Buffer) {
  let n = 0
  while (n * 2 < name.length && name.readInt16LE(n * 2) !== 0) {
    ++n
  }

  return iconv.decode(name.slice(0, n * 2), 'utf-16')
}

export const REPLAY = {
  COMPRESSED: 0x1,
  TAG: 0x2,
  DECODED: 0x4,
  SINGLE_MODE: 0x8
}

function range(last: number) {
  return [...new Array(last)].map((_, i) => i)
}

function doReadReplay(reader: BufferReader): ReplayData {
  const id = reader.nextI32()
  const version = reader.nextI32()
  const flag = reader.nextU32()
  const seed = reader.nextI32()
  const lzmaSize = reader.nextBytes(4)
  const hash = reader.nextI32()
  const lzmaProps = reader.nextBytes(8)
  const rest = reader.rest()
  const body = flag & REPLAY.COMPRESSED ? fromCompressed(lzmaProps, lzmaSize, rest) : rest
  const bodyReader = new BufferReader(body)
  const nplayers = flag & REPLAY.TAG ? 4 : 2
  const many = range(nplayers)
  const names = many.map(() => translate(Buffer.from(bodyReader.nextBytes(40))))
  const lp = bodyReader.nextI32()
  const hand = bodyReader.nextU32()
  const draw = bodyReader.nextU32()
  const options = bodyReader.nextU32()
  const decks = many.map(() => {
    const main = readDeck(bodyReader)
    const extra = readDeck(bodyReader)
    return { main, extra }
  })
  const players = names.map((name, i) => ({ name, ...decks[i] }))
  const responses = bodyReader.rest()

  return {
    id,
    version,
    seed,
    flag,
    lp,
    hand,
    draw,
    options,
    hash,
    players,
    responses,
  }
}

function readDeck(reader: BufferReader) {
  const count = reader.nextU32()
  return range(count).map(() => reader.nextU32())
}

class BufferReader {
  constructor(
    private buffer: Buffer,
    private off: number = 0
  ) { }

  fork() {
    return new BufferReader(this.buffer, this.off)
  }

  slice(length: number) {
    const slice = this.buffer.slice(this.off, this.off + length)
    this.off += length
    return slice
  }

  noMore() {
    return this.buffer.length <= this.off
  }

  rest() {
    return this.buffer.slice(this.off)
  }

  nextBytes(length: number): number[] {
    const out: number[] = []
    for (let i = 0; i !== length; ++i) {
      out.push(this.nextU8())
    }
    return out
  }

  nextI8() {
    return this.buffer.readInt8(this.off++)
  }

  nextU8() {
    return this.buffer.readUInt8(this.off++)
  }

  nextI16() {
    return this.buffer.readInt16LE((this.off += 2) - 2)
  }

  nextU16() {
    return this.buffer.readUInt16LE((this.off += 2) - 2)
  }

  nextI32() {
    return this.buffer.readInt32LE((this.off += 4) - 4)
  }

  nextU32() {
    return this.buffer.readUInt32LE((this.off += 4) - 4)
  }
}
