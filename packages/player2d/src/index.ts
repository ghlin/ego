import * as Pixi from 'pixi.js'
import { Player } from './player'
import { request } from './bits/misc'

Pixi.settings.SCALE_MODE = Pixi.SCALE_MODES.LINEAR

const canvas = document.querySelector('#playground') as HTMLCanvasElement
const app = new Pixi.Application({
  view: canvas,
  resolution: window.devicePixelRatio,
  antialias: false,
  width: canvas.clientWidth,
  height: canvas.clientHeight
})

class ListItem {
  id: string

  li = document.createElement('li')

  constructor(callback: (id: string) => void) {
    this.li.addEventListener('click', () => callback(this.id))
  }

  bind(replay: { id: string, players: string[] }) {
    this.id = replay.id
    this.li.innerText = replay.players.join(' v.s. ')
  }

  public set hide(hidden: boolean) {
    this.li.style.visibility = hidden ? 'hidden' : 'visible'
  }
}

async function setup() {
  app.resizeTo = canvas
  const player = new Player()
  app.stage.addChild(player.container)
  app.ticker.add(() => player.step())

  const span = document.querySelector('#pagination-info') as HTMLSpanElement
  const prev = document.querySelector('#prev-page') as HTMLButtonElement
  const next = document.querySelector('#next-page') as HTMLButtonElement

  const results = document.querySelector('#list') as HTMLUListElement

  const playById = async (id: string) => {
    const replay = await request('GET', `/assets/replays/${id}.laminated.json`).then(JSON.parse)
    await player.init(replay)
    player.start()
  }

  const items = [...new Array(18)].map(() => new ListItem(playById))

  for (const item of items) {
    results.appendChild(item.li)
    item.hide = true
  }

  const replayIndex: Record<string, [string, string]> = await request('GET', 'assets/replays/index.json').then(JSON.parse)
  const replays = Object.keys(replayIndex).map(id => ({ id, players: replayIndex[id] }))

  const pagination = {
    current: 0,
    total: Math.ceil(replays.length / items.length)
  }

  function refresh() {
    span.innerText = `${pagination.current + 1}/${pagination.total}`

    for (let i = 0; i !== items.length; ++i) {
      const replay = replays[pagination.current * items.length + i]
      const item   = items[i]
      if (!replay) {
        item.hide = true
      } else {
        item.hide = false
        item.bind(replay)
      }
    }
  }

  prev.addEventListener('click', () => {
    if (pagination.current - 1 >= 0) {
      --pagination.current
      refresh()
    }
  })

  next.addEventListener('click', () => {
    if (pagination.current + 1 < pagination.total) {
      ++pagination.current
      refresh()
    }
  })

  refresh()

  playById(replays[0].id)
}

setup()
