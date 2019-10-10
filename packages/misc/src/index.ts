import * as E from 'ansi-escapes'

export function echo(message: string) {
  process.stdout.write(`${E.eraseStartLine}${E.cursorLeft}${message}`)
}

export function echoln(message: string) {
  process.stdout.write(`${E.eraseStartLine}${E.cursorLeft}${message}\n`)
}

export function prettyBuffer(buffer: Buffer, every: number = 4, width: number = 16) {
  const lines: string[] = []
  const line: string[] = []

  buffer.forEach((byte, offset) => {
    if (offset % width === 0) {
      line.push(offset.toString(16).padStart(4, ' ') + ' |')
    }
    if (offset % every === 0) {
      line.push(offset.toString(16).padStart(2, '0'))
    }
    line.push(' ' + byte.toString(16).padStart(2, '0'))

    if ((offset + 1) % 16 === 0) {
      lines.push(line.join(''))
      line.splice(0, line.length)
    }
  })

  if (line.length !== 0) {
    lines.push(line.join(''))
  }

  return lines
}

export function dumpBuffer(buffer: Buffer, every: number = 4, width: number = 16) {
  prettyBuffer(buffer, every, width).forEach(line => console.log(line))
}

export function flatten<T>(nested: T[][]): T[] {
  return nested.reduce((acc, val) => acc.concat(val), [])
}

type DiscrUnion<T, K extends keyof T, V extends T[K]> = T extends Record<K, V> ? T : never

export type MapDiscrUnion<T extends Record<K, string>, K extends keyof T> = {
  [V in T[K]]: DiscrUnion<T, K, V>
}
