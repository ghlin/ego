import { CoreEngine } from '@ego/engine-interface'
import { isQuestionMessage, LOCATION, Message, MSG, parseMessage, Question } from '@ego/message-protocol'
import { flatten, prettyBuffer } from '@ego/common'
import { HostMessage } from './message'

// const REFRESH_HAND_FLAGS = 0x781FFF
const REFRESH_GRAVE_FLAGS  = 0x181FFF
const REFRESH_DECK_FLAGS   = 0x181FFF
const REFRESH_EXTRA_FLAGS  = 0x181FFF
const REFRESH_SINGLE_FLAGS = 0xF81FFF
const REFRESH_FLAGS        = 0xF81FFF

function wrap(what: Message): HostMessage {
  return { tag: 'HOST_DUEL_MESSAGE', to: [], what }
}

export function replayStart(engine: CoreEngine, duel: number): HostMessage[] {
  return doReplayStart(engine, duel).map(wrap)
}

export function replayInflate(engine: CoreEngine, duel: number, message: Message): HostMessage[] {
  return isQuestionMessage(message)
    ? handleQuestion(engine, duel, message).map(wrap)
    : handleMessage(engine, duel, message).map(wrap)
}

function doReplayStart(engine: CoreEngine, duel: number): Message[] {
  return flatten([
    refresh2(engine, duel, LOCATION.DECK, REFRESH_DECK_FLAGS),
    refresh2(engine, duel, LOCATION.EXTRA, REFRESH_EXTRA_FLAGS)
  ])
}

function handleQuestion(engine: CoreEngine, duel: number, q: Question): Message[] {
  const out: Message[][] = [[q]]

  switch (q.msgtype) {
  case 'MSG_SELECT_BATTLECMD':
  case 'MSG_SELECT_IDLECMD':
    out.push(refreshReplay(engine, duel))
  }

  return flatten(out)
}

function handleMessage(engine: CoreEngine, duel: number, m: Message): Message[] {
  const messages = [[m]]

  switch (m.msgtype) {
  case 'MSG_TAG_SWAP':
    throw new Error('TAG message not supported')

  case 'MSG_NEW_PHASE':
  case 'MSG_SUMMONED':
  case 'MSG_SPSUMMONED':
  case 'MSG_FLIPSUMMONED':
  case 'MSG_CHAINED':
  case 'MSG_CHAIN_SOLVED':
  case 'MSG_CHAIN_END':
  case 'MSG_DAMAGE_STEP_START':
    messages.push(refreshReplay(engine, duel))
    break

  case 'MSG_REVERSE_DECK':
    messages.push(refresh2(engine, duel, LOCATION.DECK, REFRESH_DECK_FLAGS))
    break

  case 'MSG_SHUFFLE_DECK':
    messages.push(refresh1(engine, duel, m.player, LOCATION.DECK, REFRESH_DECK_FLAGS))
    break

  case 'MSG_SWAP_GRAVE_DECK':
    messages.push(refresh1(engine, duel, m.player, LOCATION.GRAVE, REFRESH_GRAVE_FLAGS))
    break

  case 'MSG_MOVE':
    {
      const cl = m.current.location
      const cc = m.current.controller
      const cs = m.current.sequence
      const pl = m.previous.location
      const pc = m.previous.controller

      if (cl && !(cl & LOCATION.OVERLAY) && (cl !== pl || cc !== pc)) {
        messages.push(refreshSingle(engine, duel, cc, cl, cs))
      }
    }
    break
  }

  return flatten(messages)
}

interface RefreshParam {
  player: number
  location: number
  flags: number
}

function prepend(header: number[], data: ArrayBuffer) {
  return Buffer.concat([Buffer.from(header), Buffer.from(data)])
}

function doRefresh(engine: CoreEngine, duel: number, param: RefreshParam) {
  const data = engine.queryFieldCard(duel, { ...param, cache: false })
  const buffer = prepend([MSG.UPDATE_DATA, param.player, param.location], data)
  try {
    return parseMessage(buffer)
  } catch (error) {
    console.error(`error queryFieldCard:`)
    prettyBuffer(buffer).forEach(line => console.error(line))
    throw error
  }
}

function doRefreshSingle(engine: CoreEngine, duel: number, param: RefreshParam & { sequence: number }) {
  const data = engine.queryCard(duel, { ...param, cache: false })
  const buffer = prepend([MSG.UPDATE_CARD, param.player, param.location, param.sequence], data)
  try {
    return parseMessage(buffer)
  } catch (error) {
    console.error(`error queryCard:`)
    prettyBuffer(buffer).forEach(line => console.error(line))
    throw error
  }
}

function refreshSingle(
  engine: CoreEngine,
  duel: number,
  player: number,
  location: number,
  sequence: number,
  flags: number = REFRESH_SINGLE_FLAGS
) {
  return doRefreshSingle(engine, duel, { player, location, sequence, flags })
}

function refresh1(engine: CoreEngine, duel: number, player: number, location: number, flags: number = REFRESH_FLAGS) {
  return doRefresh(engine, duel, { player, location, flags })
}

function refresh2(engine: CoreEngine, duel: number, location: number, flags: number = REFRESH_FLAGS) {
  return flatten([
    doRefresh(engine, duel, { player: 0, location, flags }),
    doRefresh(engine, duel, { player: 1, location, flags })])
}

function refreshReplay(engine: CoreEngine, duel: number, flags = REFRESH_FLAGS) {
  return flatten([
    refresh2(engine, duel, LOCATION.MZONE, flags),
    refresh2(engine, duel, LOCATION.SZONE, flags),
    refresh2(engine, duel, LOCATION.HAND, flags)
  ])
}
