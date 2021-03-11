import { Message, Question, isQuestionMessage } from '@ego/message-protocol'

export interface HostDuelMessage {
  tag: 'HOST_DUEL_MESSAGE'
  to: number[]
  what: Message
}

export interface HostError {
  tag: 'HOST_ERROR'
  what: any
}

export interface HostDuelFinished {
  tag: 'HOST_DUEL_FINISHED'
}

export type HostMessage = HostDuelMessage | HostError | HostDuelFinished

export interface HostDuelQuestion {
  tag: 'HOST_DUEL_MESSAGE'
  to: [number]
  what: Question
}

export function isHostAwaitingResponse(message: HostMessage): message is HostDuelQuestion {
  return message.tag === 'HOST_DUEL_MESSAGE'
    && message.to.length === 1
    && isQuestionMessage(message.what)
}
