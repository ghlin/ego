import { LOCATION, POS, Message, MsgStart, MsgUpdateCard, MsgMove, HINT } from '@ego/message-protocol'
import { CardRecordWithText, instantiate, MessageTemplate } from '@ego/common'

interface ClientCardState {
  code: number

  controller: number
  location: number
  sequence: number
  position: number

  type?: number
  level?: number
  attribute?: number
  race?: number
  attack?: number
  defense?: number
  lscale?: number
  rscale?: number
}

interface Related<T> {
  container: T[]
  target?: T
}

type UpdateCardInfo = Omit<MsgUpdateCard, 'msgtype'>
// type PartialUpdateCardInfo = Omit<UpdateCardInfo, 'player' | 'location'>

class DuelMat<T> {
  containers: Array<Record<number, Array<ClientCard<T>>>> = []

  constructor() {
    this.containers = [{}, {}]
    const locations = [
      LOCATION.DECK, LOCATION.EXTRA, LOCATION.GRAVE, LOCATION.HAND,
      LOCATION.MZONE, LOCATION.SZONE, LOCATION.REMOVED
    ]

    for (const location of locations) {
      this.containers[0][location] = []
      this.containers[1][location] = []
    }

    const dummy = [...new Array(5)].map(() => undefined) as any
    for (const p of [0, 1]) {
      this.containers[p][LOCATION.MZONE].splice(0, 0, ...dummy)
      this.containers[p][LOCATION.SZONE].splice(0, 0, ...dummy)
    }
  }

  at(playerId: number, location: number) {
    return this.containers[playerId][location]
  }
}

export class ClientCard<T> {
  public data: T

  current: ClientCardState = {
    code: 0,
    controller: 0,
    location: 0,
    sequence: 0,
    position: POS.FACEDOWN
  }

  previous: ClientCardState = {
    code: 0,
    controller: 0,
    location: 0,
    sequence: 0,
    position: POS.FACEDOWN
  }

  overlay: Related<this> = { container: [] }
  equipment: Related<this> = { container: [] }

  dirty = false

  constructor(readonly duel: DuelState<T>) { }

  set(code: number) {
    this.code  = code
    this.dirty = true

    this.duel.listeners.onSetCode(this)
  }

  snapshot() {
    this.previous = { ...this.current }
  }

  update(uci: UpdateCardInfo) {
    this.dirty = true
    if (uci.code) {
      this.code = uci.code
    }

    if (uci.info?.position) {
      this.position = uci.info.position
    }
    // TODO:  2021-03-12 21:50:49
  }

  public set code(value: number) {
    this.current.code = value
  }

  public set controller(value: number) {
    this.current.controller = value
  }

  public set location(value: number) {
    this.current.location = value
  }

  public set sequence(value: number) {
    this.current.sequence = value
  }

  public set position(value: number) {
    this.current.position = value
  }

  public get code() {
    return this.current.code
  }

  public get controller() {
    return this.current.controller
  }

  public get location() {
    return this.current.location
  }

  public get sequence() {
    return this.current.sequence
  }

  public get position() {
    return this.current.position
  }
}

export interface DuelStateListeners<T> {
  onNewCard(target: ClientCard<T>): void

  onAdjustSequence(container: Array<ClientCard<T>>): void

  onMove(target: ClientCard<T>): void

  onSetPosition(target: ClientCard<T>): void

  onUpdateCard(target: ClientCard<T>): void

  // token spawned
  onSpawn(target: ClientCard<T>): void

  // token despawned
  onDespawn(target: ClientCard<T>): void

  onSetCode(target: ClientCard<T>): void

  onHighlight(target: ClientCard<T>): void

  onHighlightCode(code: number): void

  onLog(log: string): void

  onHintMessage(message: string): void

  onReveal(target: ClientCard<T>): void

  onShuffle(controller: number, location: number, container: Array<ClientCard<T>>): void
}

export const DuelClientSettings = {
  debugging: false
}

export class DuelState<T> {
  constructor(
    readonly templates: Record<
      'system' | 'victory' | 'counter' | 'setname',
      Map<number, MessageTemplate>>,
    readonly query: (code: number) => CardRecordWithText | undefined,
  ) {
    void this.formatType
    void this.formatLocation
  }

  mat          = new DuelMat<T>()
  turn         = Number.NaN
  turnPlayerId = Number.NaN
  phase        = Number.NaN
  lp           = [Number.NaN, Number.NaN]

  currentChainTarget?: ClientCard<T>

  hints = {
    event: ''
  }

  message: Message

  listeners: DuelStateListeners<T> = {
    onNewCard()        { return },
    onMove()           { return },
    onSetPosition()    { return },
    onUpdateCard()     { return },
    onAdjustSequence() { return },
    onSpawn()          { return },
    onDespawn()        { return },
    onSetCode()        { return },
    onHighlight()      { return },
    onHighlightCode()  { return },
    onShuffle()        { return },

    onReveal()         { return },

    // onLog()            { return },
    onLog(message) {
      console.log('[duel-client::onLog] ' + message)
    },

    // onHintMessage()    { return }
    onHintMessage(message) {
      console.log('[duel-client::onHintMessage] ' + message)
    }
  }

  adjustSequence = (c: ClientCard<T>, sequence: number) => {
    if (c.sequence !== sequence) {
      c.dirty = true
    }
    c.sequence = sequence
  }

  // replay doesn't contain a MSG_START message,
  // initial state was provided by replay file itself.
  init(msg: Omit<MsgStart, 'msgtype'>) {
    this.lp           = msg.start_LP
    this.turn         = 0
    this.turnPlayerId = 0
    this.phase        = 0

    for (let playerId = 0; playerId !== msg.deck_count.length; ++playerId) {
      const mainDeck = this.locate(playerId, LOCATION.DECK)
      for (let i = 0; i !== msg.deck_count[playerId].main_deck; ++i) {
        const card = new ClientCard(this)

        card.controller = playerId
        card.location   = LOCATION.DECK
        card.sequence   = i
        card.position   = POS.FACEDOWN_ATTACK
        card.code       = 0

        this.listeners.onNewCard(card)
        this.listeners.onSpawn(card)

        mainDeck.push(card)
      }

      const extraDeck = this.locate(playerId, LOCATION.EXTRA)
      for (let i = 0; i !== msg.deck_count[playerId].extra_deck; ++i) {
        const card = new ClientCard(this)

        card.controller = playerId
        card.location   = LOCATION.EXTRA
        card.sequence   = i
        card.position   = POS.FACEDOWN_ATTACK
        card.code       = 0

        this.listeners.onNewCard(card)
        this.listeners.onSpawn(card)

        extraDeck.push(card)
      }
    }
  }

  locate(controller: number, location: number) {
    const container = this.mat.at(controller, location & 0x7F)
    if (!container) {
      throw new Error(`DuelState::at(controller = ${controller}, location = ${location}): no container.`)
    }

    return container
  }

  at(controller: number, location: number, sequence: number, subsequence?: number) {
    const isOverlay = hasBits(location, LOCATION.OVERLAY)
    const container = this.locate(controller, location)
    const target    = container[sequence]

    if (!target) {
      throw new Error(`DuelState::at(controller = ${controller}, location = ${location}, sequence = ${sequence}): no entity.`)
    }

    return isOverlay ? target.overlay.container[subsequence!] : target
  }

  put(card: ClientCard<T>, controller: number, location: number, sequence: number) {
    card.dirty = true

    const container = this.locate(controller, location)

    card.controller = controller
    card.location   = location

    if (DuelClientSettings.debugging) {
      // pre validation
      for (const e of container) {
        if (e && e === card) {
          console.warn(`collide!`)
          throw new Error('what')
        }
      }
    }

    if (location === LOCATION.HAND || location === LOCATION.GRAVE || location === LOCATION.REMOVED) {
      // when put card to hand/graveyard/banished zone,
      // always put it to the back of the pile, ignoring the `sequence` param.
      container.push(card)
      card.sequence = container.length - 1
    } else if (location === LOCATION.MZONE || location === LOCATION.SZONE) {
      container[sequence] = card
      card.sequence = sequence
    } else if (location === LOCATION.DECK) {
      if (sequence !== 0) {
        // sequence != 0: put to top.
        container.push(card)
        card.sequence = container.length - 1
      } else {
        container.splice(0, 0, card)
        container.forEach(this.adjustSequence)
        this.listeners.onAdjustSequence(container)
      }
    } else if (location === LOCATION.EXTRA) {
      if (hasBits(card.position, POS.FACEUP)) {
        // faceup: put to top.
        container.push(card)
        card.sequence = container.length - 1
      } else {
        // #BOTTOM# ...facedown..., <insert here>, ...faceup... #TOP#
        const index = container.findIndex(c => hasBits(c.position, POS.FACEUP))
        container.splice(index === -1 ? container.length - 1 : index, 0, card)
        container.forEach(this.adjustSequence)
        this.listeners.onAdjustSequence(container)
      }
    } else {
      throw new Error(`DuelState::put(location = ${location}) invalid location`)
    }

    if (DuelClientSettings.debugging) {
      this._validate(controller, location, container)
    }
  }

  remove(controller: number, location: number, sequence: number) {
    const container = this.locate(controller, location)
    if (location === LOCATION.SZONE || location === LOCATION.MZONE) {
      const target = container[sequence]
      target.dirty = true

      container[sequence] = undefined as any
      return target
    } else {
      const target = container.splice(sequence, 1)[0]
      target.dirty = true

      container.forEach(this.adjustSequence)
      this.listeners.onAdjustSequence(container)
      return target
    }
  }

  update(controller: number, location: number, sequence: number, uci: UpdateCardInfo) {
    const target = this.at(controller, location, sequence)
    if (!target) {
      console.warn(`DuelState::update(controller = ${controller}, location = ${location}, sequence = ${sequence}): not found`)
      return
    }

    target.update(uci)
    this.listeners.onUpdateCard(target)
  }

  handle(msg: Message) {
    this._cleanup()
    this.message = msg

    // here comes the big switch.
    switch (msg.msgtype) {
      case 'MSG_START': {
        this.init(msg)

        break
      }

      case 'MSG_DRAW': {
        const controller = msg.player
        const container  = this.locate(controller, LOCATION.DECK)
        const cards      = container.splice(container.length - msg.cards.length, msg.cards.length)
        for (let i = 0; i !== cards.length; ++i) {
          const target = cards[i]
          target.set(msg.cards[i])
          this.put(target, controller, LOCATION.HAND, 0)
          this.listeners.onMove(target)
        }

        this.listeners.onAdjustSequence(this.locate(controller, LOCATION.HAND))

        break
      }

      case 'MSG_SWAP': {
        const fst = this.at(msg.first.controller, msg.first.location, msg.first.sequence)
        const snd = this.at(msg.second.controller, msg.second.location, msg.second.sequence)

        this.remove(msg.first.controller, msg.first.location, msg.first.sequence)
        this.remove(msg.second.controller, msg.second.location, msg.second.sequence)

        this.put(fst, msg.second.controller, msg.second.location, msg.second.sequence)
        this.put(snd, msg.first.controller, msg.first.location, msg.first.sequence)

        this.listeners.onMove(fst)
        this.listeners.onMove(snd)

        break
      }

      case 'MSG_MOVE': {
        this._handleMove(msg)
        break
      }

      case 'MSG_POS_CHANGE': {
        const target    = this.at(msg.current_controller, msg.current_location, msg.current_sequence)
        target.position = msg.current_position
        target.dirty    = true

        this.listeners.onSetPosition(target)

        break
      }

      case 'MSG_HINT': {
        switch (msg.type) {
          case HINT.EVENT: {
            this.hints.event = this._render('system', msg.data)
            break
          }

          case HINT.MESSAGE: {
            this.listeners.onHintMessage(this._renderSystemOrDesc(msg.data))
            break
          }

          case HINT.OPSELECTED: {
            const desc = this._renderSystemOrDesc(msg.data)
            this.listeners.onHintMessage(this._render('system', 1510, desc))
            break
          }

          case HINT.CARD:
          case HINT.EFFECT: {
            this.listeners.onHighlightCode(msg.data)
            break
          }

          case HINT.RACE:
          case HINT.ATTRIB: {
            const name = msg.type === HINT.RACE   ? this.formatRace(msg.data)
                       : msg.type === HINT.ATTRIB ? this.formatAttribute(msg.data)
                       :        '...'
            this.listeners.onHintMessage(this._render('system', 1511, name))
            break
          }

          case HINT.CODE: {
            const entry = this.query(msg.data)
            if (!entry) {
              console.warn(`missing entry ${msg.data}`)
              return
            }

            this.listeners.onHintMessage(this._render('system', 1511, entry.name))
            break
          }

          case HINT.ZONE: {
            // FIXME: unsigned bitwise lshift? 2021-03-18 23:04:30
            // let data            = msg.player === 1 ? ((msg.data >> 16) | (msg.data << 16)) : msg.data
            // const zones: string[] = []

            // for (let d = 0; d !== 32; ++d) {
            //   const filter = 1 << d
            //   let pattern = filter & data
            //   if (pattern & 0x60) {
            //     zones.push(this._render('system', 1081))
            //     data &= ~0x600000
            //   } else if (pattern & 0xFFFF) {
            //     zones.push(this._render('system', 102))
            //   } else if (pattern & 0xFFFF0000) {
            //     zones.push(this._render('system', 103))
            //     pattern >>= 16
            //   }
            //   if (pattern & 0x1F) {
            //     zones.push(this._render('system', 1002))
            //   } else if (pattern & 0xFF00) {
            //     pattern >>= 8
            //     if (pattern & 0x1F) {
            //       zones.push(this._render('system', 1003))
            //     } else if (pattern & 0x20) {
            //       zones.push(this._render('system', 1008))
            //     } else if (pattern & 0xc0) {
            //       zones.push(this._render('system', 1009))
            //     }
            //   }
            // }
          }
        }
        break
      }

      case 'MSG_CONFIRM_DECKTOP': {
        this.listeners.onLog(this._render('system', 207, msg.cards.length.toString()))
        const deck = this.locate(msg.player, LOCATION.DECK)
        for (let i = 0; i !== msg.cards.length; ++i) {
          const code = msg.cards[i].code
          const target = deck[deck.length - i - 1]
          if (code) { target.set(code) }
          this.listeners.onReveal(target)
          const entry = this.query(target.code)
          this.listeners.onLog(` * [${entry?.name}]`)
        }

        break
      }

      case 'MSG_CONFIRM_EXTRATOP': {
        this.listeners.onLog(this._render('system', 207, msg.cards.length.toString()))
        const extra = this.locate(msg.player, LOCATION.EXTRA)
        const poff  = extra.findIndex(e => e.position & POS.FACEUP)
        const base  = extra.length - (poff === -1 ? 0 : poff) - 1
        for (let i = 0; i !== msg.cards.length; ++i) {
          const code = msg.cards[i].code
          const target = extra[base - i]
          if (code) { target.set(code) }
          this.listeners.onReveal(target)
          const entry = this.query(target.code)
          this.listeners.onLog(` * [${entry?.name}]`)
        }

        break
      }

      case 'MSG_SHUFFLE_DECK': {
        const deck = this.locate(msg.player, LOCATION.DECK)
        for (const target of deck) {
          target.set(0)
        }
        this.listeners.onShuffle(msg.player, LOCATION.DECK, deck)
        break
      }

      case 'MSG_SHUFFLE_HAND': {
        const hand = this.locate(msg.player, LOCATION.HAND)
        for (let i = 0; i !== msg.cards.length; ++i) {
          hand[i].set(msg.cards[i])
        }
        this.listeners.onShuffle(msg.player, LOCATION.HAND, hand)
      }

      case 'MSG_SHUFFLE_EXTRA': {
        // TODO: reminder 2021-03-21 21:37:40
        break
      }

      case 'MSG_SWAP_GRAVE_DECK': {
        // TODO: reminder 2021-03-21 21:38:01
        break
      }

      case 'MSG_REVERSE_DECK': {
        // TODO: reminder 2021-03-21 21:38:39
        break
      }

      case 'MSG_DECK_TOP': {
        // TODO: reminder 2021-03-21 21:38:46
        break
      }

      case 'MSG_SHUFFLE_SET_CARD': {
        // TODO: reminder 2021-03-21 21:39:10
        break
      }

      case 'MSG_NEW_TURN': {
        this.turn++
        this.turnPlayerId = msg.player
        break
      }

      case 'MSG_SET': {
        this.listeners.onHintMessage(this._render('system', 1601))
        break
      }

      case 'MSG_FIELD_DISABLED': {
        // TODO: reminder 2021-03-21 21:41:08
        break
      }

      case 'MSG_SPSUMMONING':
      case 'MSG_FLIPSUMMONING':
      case 'MSG_SUMMONING': {
        const entry = this.query(msg.code)
        const templateId = msg.msgtype === 'MSG_SUMMONING'     ? 1603
                         : msg.msgtype === 'MSG_SPSUMMONING'   ? 1605
                         : msg.msgtype === 'MSG_FLIPSUMMONING' ? 1607
                         : 0
        this.listeners.onHintMessage(this._render('system', templateId, entry?.name!))
        break
      }

      case 'MSG_SUMMONED':
      case 'MSG_FLIPSUMMONED':
      case 'MSG_SPSUMMONED': {
        const templateId = msg.msgtype === 'MSG_SUMMONED'      ? 1604
                         : msg.msgtype === 'MSG_SPSUMMONED'    ? 1606
                         : msg.msgtype === 'MSG_FLIPSUMMONED'  ? 1608
                         : 0

        this.listeners.onHintMessage(this._render('system', templateId))
        break
      }

      case 'MSG_CHAINING': {
        // TODO: previous chain target 2021-03-21 21:47:01
        const target = this.at(msg.controller, msg.location, msg.sequence, msg.subsequence)
        this.currentChainTarget = target
        this.listeners.onHighlight(target)
        break
      }

      case 'MSG_CHAINED': {
        if (this.currentChainTarget) {
          const entry = this.query(this.currentChainTarget.code)
          this.listeners.onHintMessage(this._render('system', 1609, entry?.name!))
          this.currentChainTarget = undefined
        } else {
          console.warn(`[duel-client] MSG_CHAINED, currentChainTarget = null`)
        }
        break
      }

      case 'MSG_BECOME_TARGET': {
        for (const c of msg.cards) {
          const target = this.at(c.controller, c.location, c.sequence, c.subsequence)
          const entry = this.query(target.code)
          this.listeners.onLog(this._render('system', 1610, entry?.name!, this.formatLocation(c.location, c.sequence), c.sequence + 1))
          this.listeners.onHighlight(target)
        }
      }

      // LABEL HERE.
      default: { break }
    }
  }

  private _handleMove(msg: MsgMove) {
    const p = msg.previous
    const c = msg.current
    if (p.location === 0) {
      // token spawn
      const token = new ClientCard(this)

      token.controller = c.controller
      token.location   = c.location
      token.sequence   = c.sequence
      token.position   = c.pos_or_subseq

      this.listeners.onNewCard(token)

      token.set(msg.code)

      this.put(token, c.controller, c.location, c.sequence)

      this.listeners.onSpawn(token)
    } else if (c.location === 0) {
      // token die
      const token = this.at(p.controller, p.location, p.sequence)
      if (msg.code) {
        token.set(msg.code)
      }

      this.remove(p.controller, p.location, p.sequence)

      this.listeners.onDespawn(token)
    } else {
      const isFromOverlay = hasBits(p.location, LOCATION.OVERLAY)
      const isToOverlay   = hasBits(c.location, LOCATION.OVERLAY)

      if (!isFromOverlay && !isToOverlay) {
        const target = this.at(p.controller, p.location, p.sequence)
        this.remove(p.controller, p.location, p.sequence)
        this.put(target, c.controller, c.location, c.sequence)

        target.position = c.pos_or_subseq

        if (msg.code || c.location === LOCATION.EXTRA) {
          target.set(msg.code)
        }

        this.listeners.onMove(target)
      } else if (!isFromOverlay) {
        const target = this.at(p.controller, p.location, p.sequence)
        const ol     = this.at(c.controller, c.location & 0x7F, c.sequence)

        this.remove(p.controller, p.location, p.sequence)

        ol.overlay.container.push(target)
        target.overlay.target = ol
        target.sequence       = ol.overlay.container.length - 1
        target.location       = ol.location | LOCATION.OVERLAY
        target.controller     = ol.controller

        if (msg.code) { target.set(msg.code) }

        this.listeners.onMove(target)
      } else if (!isToOverlay) {
        const ol     = this.at(p.controller, p.location & 0x7F, p.sequence)
        const target = ol.overlay.container[p.subsequence]

        ol.overlay.container.splice(p.subsequence, 1)
        ol.overlay.container.forEach(this.adjustSequence)

        target.overlay.target = undefined

        this.put(target, c.controller, c.location, c.sequence)

        this.listeners.onMove(target)
      } else {
        // from overlayed to overlayed.
        const ol1 = this.at(p.controller, p.location & 0x7F, p.sequence)
        const ol2 = this.at(c.controller, c.location & 0x7F, c.sequence)

        const target = ol1.overlay.container[p.subsequence]

        ol1.overlay.container.splice(p.subsequence, 1)
        ol2.overlay.container.push(target)

        target.location = ol2.location | LOCATION.OVERLAY
        target.sequence = ol2.overlay.container.length - 1
        target.overlay.target = ol2

        ol1.overlay.container.forEach(this.adjustSequence)

        this.listeners.onMove(target)
        this.listeners.onAdjustSequence(ol1.overlay.container)
      }
    }
  }

  private _render(
    category: 'system' | 'victory' | 'counter' | 'setname',
    id: number,
    ...args: Array<string | number>
  ) {
    const template = this.templates[category].get(id)
    if (!template) {
      return `<<missing template: ${category}#${id}>>`
    }

    return instantiate(template, args)
  }

  private _renderSystemOrDesc(bits: number) {
    if (bits < 10000) {
      return this._render('system', bits)
    }

    const code = bits >> 4
    const id   = bits & 0xF

    const entry = this.query(code)
    if (!entry) {
      return `<<missing entry: ${code}#${id}>>`
    }

    return entry.texts[id] ?? `<<missing entry text: ${code}#${id}`
  }

  formatRace(value: number) {
    return this._filterPattern(value, 0x2000000, 1020).join(', ')
  }

  formatType(value: number) {
    return this._filterPattern(value, 0x8000000, 1050).join(', ')
  }

  formatAttribute(value: number) {
    return this._filterPattern(value, 0x80, 1010).join(', ')
  }

  formatLocation(location: number, sequence: number) {
    location &= ~LOCATION.OVERLAY
    if (location === LOCATION.SZONE) {
      return sequence < 5 ? this._render('system', 1003)
           : sequence > 5 ? this._render('system', 1009)
           :                this._render('system', 1008)
    }

    let index = 1000
    let filter = 1

    while (filter !== 0x100 && filter !== location) {
      filter <<= 1
      ++index
    }

    if (filter === location) {
      return this._render('system', index)
    }
    if (location === 0) {
      return '<token pile>'
    }

    throw new Error(`<unknown location:${location} / ${sequence}>`)
  }

  private _filterPattern(value: number, filterMax: number, index: number) {
    const hits: string[] = []
    for (let filter = 1; filter < filterMax; filter <<= 1) {
      if (hasBits(value, filter)) {
        hits.push(this._render('system', index))
      }
      ++index
    }
    return hits
  }

  private _cleanup() {
    // clean up
    for (const container of this.mat.containers) {
      for (const pile of Object.values(container)) {
        for (const target of pile) {
          if (target) {
            target.dirty = false
            target.snapshot()
          }
        }
      }
    }
  }

  private _validate(controller: number, location: number, container: Array<ClientCard<T>>) {
    const isNodeJs = typeof process?.versions?.node !== 'undefined'
    const stringify = (o: any) => isNodeJs ? JSON.stringify(o, undefined, 3) : o

    for (let sequence = 0; sequence !== container.length; ++sequence) {
      const e = container[sequence]
      if (e && e.sequence !== sequence) {
        [
          `! Alert code       = ${e.code}`,
          `        controller = ${e.controller} (${controller} expected)`,
          `        location   = ${e.location.toString(16)} (${location.toString(16)} expected)`,
          `        sequence   = ${e.sequence} (${sequence} expected)`,
        ].forEach(line => console.log(line))

        console.log(stringify(this.message))
        console.log(stringify({
          container: container.map((c, i) => !c ? '<null>' : {
            index: i,
            controller: c.controller,
            location: c.location,
            sequence: c.sequence
          })
        }))
        throw new Error('Inconsistent duel state')
      }
    }
  }
}

function hasBits(i: number, pattern: number) {
  return (i & pattern) !== 0
}
