// --- helpers --------

// promise pool
export function parallel(
  concurrency: number,
  producer: Generator<PromiseLike<unknown>, void, unknown> | (() => Generator<PromiseLike<unknown>, void, unknown>)
) {
  const iter = typeof producer === 'function' ? producer() : producer
  return new PromisePool(concurrency, iter).run()
}

export class PromisePool {
  constructor(
    readonly concurrency: number,
    readonly producer: Generator<PromiseLike<unknown>, void, unknown>
  ) { }

  run(): Promise<unknown> {
    const dispatch = async (): Promise<unknown> => {
      const { done, value } = this.producer.next()

      if (done) { return Promise.resolve() }
      return (value as PromiseLike<unknown>).then(dispatch)
    }

    return Promise.all([...new Array(this.concurrency)].map(dispatch))
  }
}

// pretty print a buffer.
export function prettyBuffer(buffer: Buffer, every: number = 4, width: number = 16) {
  const lines = [`buffer (${buffer.length}):`]
  let line: string[] = []

  buffer.forEach((byte, offset) => {
    if (offset % width === 0) {
      line.push(offset.toString(16).padStart(4, ' ') + ' |')
    }
    if (offset % every === 0) {
      line.push(' ')
    }
    line.push(' ' + byte.toString(16).padStart(2, '0'))

    if ((offset + 1) % 16 === 0) {
      lines.push(line.join(''))
      line = []
    }
  })

  if (line.length !== 0) {
    lines.push(line.join(''))
  }

  return lines
}

// dump a buffer to console.
export function dumpBuffer(buffer: Buffer, every: number = 4, width: number = 16) {
  prettyBuffer(buffer, every, width).forEach(line => console.log(line))
}

export function flatten<T>(nested: T[][]): T[] {
  return nested.reduce((acc, val) => acc.concat(val), [])
}

// --------------------

// --- strings.conf ---
export interface MessageTemplate {
  category: 'system' | 'victory' | 'counter' | 'setname'
  id: number
  rawId: string
  rawText: string
  segments: Array<{ tag: 'string'; value: string } | { tag: 'placeholder'; index: number; specifier: string }>
  placeholders: Array<{ specifier: string }>
}

function instantiateSegment(segment: MessageTemplate['segments'][0], args: Array<string | number>) {
  if (segment.tag === 'string') { return segment.value }
  return args[segment.index]
}

export function instantiate(mt: MessageTemplate, args: Array<string | number>) {
  const segments = mt.segments.map(seg => instantiateSegment(seg, args))
  if (segments.some(v => !v)) {
    throw new Error(`Insufficient instantiation arguments.`)
  }
  return segments.join('')
}

function parseSegments(text: string): [MessageTemplate['segments'], MessageTemplate['placeholders']] {
  const segments: MessageTemplate['segments'] = []
  let index = 0
  for (const token of text.split(/(%ls|%d|%X)/)) {
    const segment = token.startsWith('%')
      ? { tag: 'placeholder', index: index++, specifier: token }
      : { tag: 'string', value: token }
    segments.push(segment as MessageTemplate['segments'][0])
  }
  const placeholders = segments
    .filter(s => s.tag === 'placeholder')
    .map(s => ({ specifier: (s as any).specifier }))
  return [segments, placeholders]
}

function doParseMessageTemplate(line: string): MessageTemplate {
  const [category, rawId, ...rawTexts] = line.split(' ')
  const rawText = rawTexts.join(' ')
  const id = (rawId.startsWith('0x') || rawId.startsWith('0X')) ? parseInt(rawId, 16) : parseInt(rawId, 10)
  const [segments, placeholders] = parseSegments(rawText)
  return { category: category as MessageTemplate['category'], id, rawId, rawText, segments, placeholders }
}

function doParseStrings(lines: string[]) {
  return lines
    .map(line => line.trim())
    .filter(line => line.startsWith('!'))
    .map(line => line.substr(1))
    .map(doParseMessageTemplate)
}

export function parseMessageTemplates(content: string) {
  return doParseStrings(content.split('\n'))
}

// --------------------

type DiscrUnion<T, K extends keyof T, V extends T[K]> = T extends Record<K, V> ? T : never

export type MapDiscrUnion<T extends Record<K, string>, K extends keyof T> = {
  [V in T[K]]: DiscrUnion<T, K, V>
}

// interfaces
export interface CardRecord {
  code: number
  alias: number
  level: number
  race: number
  type: number
  attack: number
  defense: number
  lscale: number
  rscale: number
  attribute: number
  link_marker: number
  setcode: string
}

export interface CardRecordWithText extends CardRecord {
  name: string
  description: string
  texts: string[]
}
