import { CoreEngine } from '@ego/engine-interface'
import { isQuestionMessage, LOCATION, Message, parseMessage, POS, Question } from '@ego/message-protocol'
import { prettyBuffer } from '@ego/misc'
import { HostMessage } from './message'
import { replayInflate, replayStart } from './replay'

export interface DeckInfo {
  main: number[]
  extra: number[]
}

export interface DuelOptions {
  seed: number
  lp: number
  draw: number
  start: number
  players: DeckInfo[]
  engineOptions: number
}

// TODO: configure inflator 2019-10-13 21:03:28
export class DuelDriver {
  state: DuelState

  constructor(readonly engine: CoreEngine, readonly options: DuelOptions) {
    this.state = createDuelState(engine, options)
    this.state.inflate = replayInflate
  }

  start(): HostMessage[] {
    return wrapError(() => replayStart(this.state.engine, this.state.duel))
  }

  step(): HostMessage[] {
    return wrapError(() => this.state.step())
  }

  feed(response: Buffer) {
    return this.state.feed(response)
  }

  release() {
    this.engine.endDuel(this.state.duel)
  }
}

function wrapError(fn: () => HostMessage[]): HostMessage[] {
  try { return fn() } catch (what) {
    console.error(what)
    return [{ tag: 'HOST_ERROR', what }]
  }
}

class MessageQueue {
  private queue: Message[] = []
  private index: number = 0
  constructor(private pump: () => Message[]) { }

  pull(): Message {
    return this.fill(), this.queue[this.index++]
  }

  peek(): Message {
    return this.fill(), this.queue[this.index]
  }

  private fill() {
    while (this.index === this.queue.length) {
      this.queue = this.pump()
      this.index = 0
    }
  }
}

function createDuelState(engine: CoreEngine, options: DuelOptions): DuelState {
  const duel = engine.createDuel(options.seed)

  options.players.forEach((deck, player) => {
    engine.setPlayerInfo(duel, { player, lp: options.lp, start: options.start, draw: options.draw })
    const piles: Array<[number[], number]> = [ [deck.main, LOCATION.DECK], [deck.extra, LOCATION.EXTRA] ]
    piles.forEach(([cards, location]) => cards.forEach(code => {
      engine.newCard(duel, { code, owner: player, player, location, sequence: 0, position: POS.FACEDOWN })
    }))
  })

  engine.startDuel(duel, options.engineOptions)

  function pump() {
    const [data] = engine.process(duel)
    const buffer = Buffer.from(data)
    try {
      return parseMessage(buffer)
    } catch (error) {
      console.error(`Error pumping message. buffer:`)
      prettyBuffer(buffer).forEach(line => console.error(line))
      throw error
    }
  }

  const queue = new MessageQueue(pump)
  return new DuelState(duel, engine, queue)
}

type MessageInflator = (engine: CoreEngine, duel: number, message: Message) => HostMessage[]

export class DuelState {
  lastQuestion?: Question
  finished: boolean = false
  inflate: MessageInflator

  constructor(
    readonly duel: number,
    readonly engine: CoreEngine,
    readonly queue: MessageQueue,
  ) { }

  feed(response: Buffer): boolean {
    this.engine.setResponse(this.duel,
      response.buffer.slice(response.byteOffset, response.byteOffset + response.length))

    if (this.queue.peek().msgtype === 'MSG_RETRY') {
      return false
    }

    this.lastQuestion = undefined
    return true
  }

  step(): HostMessage[] {
    if (this.finished) {
      throw new Error(`Duel finished`)
    }

    if (this.lastQuestion) {
      return [{ tag: 'HOST_DUEL_MESSAGE', to: [this.lastQuestion.player], what: this.lastQuestion }]
    }

    const m = this.queue.pull()
    const messages = this.inflate(this.engine, this.duel, m)

    if (isQuestionMessage(m)) {
      this.lastQuestion = m
    }

    if (m.msgtype === 'MSG_WIN') {
      messages.push({ tag: 'HOST_DUEL_FINISHED' })
    }

    return messages
  }
}
