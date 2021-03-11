import { Message } from '@ego/message-protocol'

export interface LaminatedReplay {
  players: Array<{
    name: string
    main: number[]
    extra: number[]
  }>
  messages: Message[]
}

