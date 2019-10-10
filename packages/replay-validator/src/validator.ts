import { CoreEngine } from '@ego/engine-interface'
import { DuelDriver, isHostAwaitingResponse } from '@ego/duel-host'
import { parseReplay, ReplayReader } from '@ego/data-loader'
import { Message } from '@ego/message-protocol'

export class Validator {
  constructor(readonly core: CoreEngine) { }

  validate(replayFileContent: Buffer) {
    const reader = new ReplayReader(parseReplay(replayFileContent))
    const replay = reader.replay
    const duel = new DuelDriver(this.core, {
      lp: replay.lp,
      draw: replay.draw,
      start: replay.hand,
      seed: reader.seed(),
      players: replay.players,
      engineOptions: replay.options
    })
    const responses = reader.responses()
    const messages: Message[] = []
    let next = 0
    try {
      outer:
      while (true) {
        const hms = duel.step()
        for (const hm of hms) {
          if (hm.tag === 'HOST_ERROR') {
            throw hm.what
          }
          if (hm.tag === 'HOST_DUEL_FINISHED') {
            break outer
          }
          messages.push(hm.what)

          if (isHostAwaitingResponse(hm)) {
            if (next >= responses.length) {
              break outer
            }

            const response = responses[next++]
            const result = duel.feed(response)
            if (!result) {
              throw new Error(`ReplayError`)
            }
          }
        }
      }
    } finally {
      duel.release()
    }

    return messages
  }
}
