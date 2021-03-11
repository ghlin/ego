import { DuelState } from '@ego/duel-client/src/index'
import { LOCATION, POS } from '@ego/message-protocol'
import * as Pixi from 'pixi.js'
import { Assets, loadAssets } from './assets'
import { ClientData, Entity } from './card'
import { LaminatedReplay } from './replay'
import { templates } from './templates'
import * as Particles from 'pixi-particles'
import * as MovingParticles from './particles/moving.json'

export const Settings = {
  entity: { width: 53, height: 72 },
  gap: 6,
  animation: {
    moving: 15,
    flipping: 15,
    highlighting: 8
  }
}

interface PileEntity {
  container: Pixi.Container
  display: ClientData
  label: Pixi.Text
  refresh: () => void
}

export class Player {
  text = new Pixi.Text('')
  ready = false

  entities: ClientData[] = []
  assets: Assets

  container = new Pixi.Container()

  index = 0
  duel: DuelState<ClientData>
  replay: LaminatedReplay
  piles: Array<Record<number, PileEntity>>

  emitter: Particles.Emitter
  particles: Pixi.ParticleContainer

  private _drawDuelMat() {
    const makeCell = (options: {
      fill: { color: number, alpha: number },
      line: { color: number, alpha: number },
      size: { w: number, h: number },
      pos: { x: number, y: number }
    }) => {
      const graphics = new Pixi.Graphics()
      graphics.beginFill(options.fill.color, options.fill.alpha)
      graphics.lineStyle(1, options.line.color, options.line.alpha)
      graphics.drawRect(0, 0, options.size.w, options.size.h)
      graphics.width  = options.size.w
      graphics.height = options.size.h
      graphics.position.set(options.pos.x - graphics.width / 2, options.pos.y - graphics.height / 2)
      return graphics
    }

    const container  = new Pixi.Container()
    container.zIndex = -1

    for (const controller of [0, 1]) {
      // monster zone
      for (const sequence of [0, 1, 2, 3, 4, 5]) {
        const pos = this.layout(controller, LOCATION.MZONE, sequence)
        const cell = makeCell({
          fill: { color: 0xFFFFFF, alpha: 0.1 },
          line: { color: 0xFFFFFF, alpha: 0.2 },
          size: { w: Settings.entity.height, h: Settings.entity.height },
          pos
        })
        container.addChild(cell)
      }
      // spell zone.
      for (const sequence of [0, 1, 2, 3, 4, 5]) {
        const color = sequence === 0 ? 0xFF0000
                    : sequence === 4 ? 0x0000FF
                    :                  0xFFFFFF
        const pos = this.layout(controller, LOCATION.SZONE, sequence)
        const cell = makeCell({
          fill: { color: color, alpha: 0.1 },
          line: { color: 0xFFFFFF, alpha: 0.2 },
          size: {
            w: sequence === 5 ? Settings.entity.width : Settings.entity.height,
            h: Settings.entity.height
          },
          pos
        })
        container.addChild(cell)
      }

      for (const location of [LOCATION.DECK, LOCATION.EXTRA, LOCATION.GRAVE, LOCATION.REMOVED]) {
        const pos = this.layout(controller, location, 0)
        const cell = makeCell({
          fill: { color: 0xFFFFFF, alpha: 0.1 },
          line: { color: 0xFFFFFF, alpha: 0.2 },
          size: { w: Settings.entity.width, h: Settings.entity.height },
          pos
        })
        container.addChild(cell)
      }
    }

    return container
  }

  private _coordinate(location: number, sequence: number) {
    switch (location) {
    case LOCATION.SZONE:
      return sequence === 5 ? [3, -1] : [2 - sequence, -2]
    case LOCATION.MZONE:
      return sequence > 4 ? [11 - sequence * 2, 0] : [2 - sequence, -1]
    case LOCATION.DECK:    return [-3, -2]
    case LOCATION.GRAVE:   return [-3, -1]
    case LOCATION.EXTRA:   return [ 3, -2]
    case LOCATION.REMOVED: return [-4, -1]
    case LOCATION.HAND:    return [3 - sequence, -4]
    }
    return [0, 0]
  }

  private coordinate(controller: number, location: number, sequence: number) {
    const s = controller === 0 ? 1 : -1
    return this._coordinate(location, sequence).map(v => v * s) as [number, number]
  }

  layout(controller: number, location: number, sequence: number) {
    const [cx, cy] = this.coordinate(controller, location, sequence)
    const w = Settings.entity.height + Settings.gap
    return { x: cx * w, y: cy * w }
  }

  constructor() {
    const canvas = document.querySelector('#playground') as HTMLCanvasElement
    this.container.position.set(canvas.clientWidth / 2, canvas.clientHeight / 2)

    this.text.anchor.set(0.5)
    this.text.style.fontFamily         = 'Sans'
    this.text.style.fill               = 'white'
    this.text.style.strokeThickness    = 0.5
    this.text.style.stroke             = 'grey'
    this.text.style.dropShadow         = true
    this.text.style.dropShadowColor    = 'black'
    this.text.style.dropShadowAlpha    = 1
    this.text.style.dropShadowAngle    = 0
    this.text.style.dropShadowBlur     = 5
    this.text.style.dropShadowDistance = 0
    this.text.style.fontSize           = 24
    this.text.text                     = 'Loading...'
  }

  private _createPile(controller: number, location: number) {
    const container = new Pixi.Container()
    const display   = new ClientData(this.assets)
    const label     = new Pixi.Text('0')

    const pos = this.layout(controller, location, 0)
    container.position.set(pos.x, pos.y)

    this._initCardSprite(display.sprite)
    container.addChild(display.sprite)

    label.anchor.set(0.5)
    label.style.fontFamily         = 'Consolas'
    label.style.fill               = 'white'
    label.style.strokeThickness    = 0.5
    label.style.stroke             = 'grey'
    label.style.dropShadow         = true
    label.style.dropShadowColor    = 'black'
    label.style.dropShadowAlpha    = 1
    label.style.dropShadowAngle    = 0
    label.style.dropShadowBlur     = 10
    label.style.dropShadowDistance = 0
    label.style.fontSize           = 24

    container.addChild(label)
    label.position.set(0)

    const refresh = () => {
      const cards  = this.duel.mat.containers[controller][location]
      const top    = cards[cards.length - 1]

      display.setCode(top?.code ?? 0)
      display.setFace(top?.position ?? POS.FACEDOWN)

      label.text  = cards.length.toString()

      if (cards.length === 0) {
        display.sprite.visible = false
      } else {
        display.sprite.visible = true
      }
    }

    return { container, display, label, refresh }
  }

  private _initCardSprite(sprite: Pixi.Sprite) {
    sprite.anchor.set(0.5)

    sprite.width  = Settings.entity.width
    sprite.height = Settings.entity.height

    // const margin = 10

    // sprite.filterArea = new Pixi.Rectangle(
    //  -margin,
    //  -margin,
    //  sprite.width + margin * 2,
    //  sprite.height + margin * 2)
  }

  async init(replay: LaminatedReplay) {
    this.ready = false

    this.container.removeChildren()

    this.container.sortableChildren = true
    this.container.addChild(this._drawDuelMat())
    this.container.addChild(this.text)

    this.entities = []
    this.index    = 0
    this.replay   = replay
    this.assets   = await loadAssets(replay)

    if (!this.emitter) {
      const texture  = new Pixi.Texture(new Pixi.BaseTexture(this.assets.textures.unknown))
      this.particles = new Pixi.ParticleContainer(800, {})
      this.emitter   = new Particles.Emitter(
        this.particles,
        [texture],
        MovingParticles)
      this.particles.filters = [
        new Pixi.filters.BlurFilter(),
        new Pixi.filters.AlphaFilter(0.2),
      ]
    }

    this.emitter.emit = false
    this.particles.removeChildren()
    this.particles.zIndex = 100
    this.container.addChild(this.particles)

    this.duel = new DuelState(templates, code => this.assets.database.find(e => e.code === code))

    this.piles = [0, 1].map(controller => {
      return {
        [LOCATION.DECK]: this._createPile(controller, LOCATION.DECK),
        [LOCATION.EXTRA]: this._createPile(controller, LOCATION.EXTRA),
        [LOCATION.GRAVE]: this._createPile(controller, LOCATION.GRAVE),
        [LOCATION.REMOVED]: this._createPile(controller, LOCATION.REMOVED)
      }
    })

    for (const side of this.piles) {
      for (const pile of Object.values(side)) {
        this.container.addChild(pile.container)
      }
    }

    this.duel.listeners.onNewCard = (target: Entity) => {
      this.entities.push(target.data = new ClientData(this.assets))
      this._initCardSprite(target.data.sprite)
      this.container.addChild(target.data.container)
    }

    this.duel.listeners.onSpawn = (target: Entity) => {
      const pos = this.layout(target.controller, target.location, target.sequence)
      target.data.sprite.position.set(pos.x, pos.y)
      target.data.setFace(target.position)
    }

    this.duel.listeners.onSetCode = (target: Entity) => {
      target.data.setCode(target.code)
      target.data.setFace(0)
    }

    this.duel.listeners.onHighlight = (target: Entity) => {
      const s      = target.data
      const sprite = s.sprite
      const scaleX = sprite.scale.x
      const scaleY = sprite.scale.y
      s.timeline = function *() {
        const frames = Settings.animation.highlighting
        for (let i = 0; i !== frames; ++i) {
          const p = i / frames
          sprite.scale.set(scaleX * (1 + p * .2), scaleY * (1 + p * .2))
          yield
        }
        for (let i = 0; i !== frames; ++i) {
          const p = 1 - i / frames
          sprite.scale.set(scaleX * (1 + p * .2), scaleY * (1 + p * .2))
          yield
        }
        sprite.scale.set(scaleX, scaleY)
      }
    }

    this.duel.listeners.onAdjustSequence = (container: Entity[]) => {
      for (const entity of container) {
        if (entity.dirty) {
          this.duel.listeners.onMove(entity)
        }
      }
    }

    this.duel.listeners.onSpawn = target => {
      const pos = this.layout(target.controller, target.location, target.sequence)
      target.data.sprite.position.set(pos.x, pos.y)
      target.data.setFace(target.position)
    }

    this.duel.listeners.onMove = (target: Entity) => {
      if (target.data.isMoving) { return }
      target.data.isMoving = true

      const isOverlay = target.location & LOCATION.OVERLAY
      const dst = isOverlay
        ? this.layout(target.overlay.target!.controller, target.overlay.target!.location, target.overlay.target!.sequence)
        : this.layout(target.controller, target.location, target.sequence)

      if (isOverlay) {
        dst.x += 2 * target.sequence + 2
        dst.y += 2 * target.sequence + 2
        target.data.sprite.zIndex = -target.sequence - 1
      }

      const sprite  = target.data.sprite
      const srcX    = sprite.position.x
      const srcY    = sprite.position.y

      const facedownBefore = !!(target.previous.position & POS.FACEDOWN)
      const facedownAfter  = !!(target.current.position & POS.FACEDOWN)
      const flip           = facedownBefore !== facedownAfter

      const name    = this.assets.database.find(p => p.code === target.code)?.name ?? '«unknown»'
      const prevLoc = this.duel.formatLocation(target.previous.location, target.previous.sequence)
      const currLoc = this.duel.formatLocation(target.location, target.sequence)

      console.log(`[${name}] from [${prevLoc} (pos = 0x${
        target.previous.position.toString(16)
      })] to [${currLoc} pos = 0x${
        target.current.position.toString(16)
      }] (${flip ? 'flip' : 'no flip'})`)

      const fromPile = this.piles[target.previous.controller]?.[target.previous.location]
      const toPile   = this.piles[target.current.controller]?.[target.current.location]

      // from F -> G
      const shouldApplyParticles = (target.previous.location & (LOCATION.MZONE | LOCATION.SZONE))
                                && (target.current.location  & LOCATION.GRAVE)

      target.data.motionEffect.enabled = true
      target.data.motionEffect.offset  = 1
      target.data.motionEffect.velocity.set((dst.x - srcX) / 5, (dst.y - srcY) / 5)

      const emitter = this.emitter
      target.data.timeline = function *() {
        if (shouldApplyParticles) {
          emitter.particleImages = [target.data.front]
          emitter.spawnPos.set(sprite.position.x, sprite.position.y)
          emitter.emit = true
          sprite.alpha = 0
        }

        if (fromPile) { fromPile.refresh() }
        if (!flip) { target.data.setFace(target.position) }

        const frames = Settings.animation.moving
        let flipDone = false
        for (let i = 0; i !== frames; ++i) {
          const p = i / frames
          sprite.position.x = lerp(p, srcX, dst.x)
          sprite.position.y = lerp(p, srcY, dst.y)

          if (shouldApplyParticles) {
            emitter.spawnPos.set(sprite.position.x, sprite.position.y)
          }

          if (flip) {
            const r = (p > 0.5 ? 1 - p : p) * 2
            sprite.width = lerp(r, Settings.entity.width, 2)
            if (!flipDone && p > 0.5) {
              flipDone = true
              target.data.setFace(target.position)
            }
          }

          yield
        }

        sprite.width      = Settings.entity.width
        sprite.position.x = dst.x
        sprite.position.y = dst.y

        if (shouldApplyParticles) {
          emitter.emit = false
          sprite.alpha = 1
        }

        target.data.motionEffect.enabled = false

        if (toPile) { toPile.refresh() }
        target.data.isMoving = false
      }
    }

    this.duel.listeners.onSetPosition = (target: Entity) => {
      if (target.data.isMoving) { return }
      target.data.timeline = function *() {
        const frames = Settings.animation.flipping
        let flipDone = false
        for (let i = 0; i !== frames; ++i) {
          const p = i / frames
          const r = (p > 0.5 ? 1 - p : p) * 2

          target.data.sprite.width = lerp(r, Settings.entity.width, 2)

          if (!flipDone && p > 0.5) {
            flipDone = true
            target.data.setFace(target.position)
          }

          yield
        }

        target.data.sprite.width = Settings.entity.width
      }
    }

    this.duel.listeners.onLog         = () => { return }
    this.duel.listeners.onHintMessage = () => { return }

    this.container.removeChild(this.text)
    this.ready = true
  }

  start() {
    this.duel.init({
      player_type: 0,
      start_LP: [8000, 8000],
      deck_count: this.replay.players.map(p => ({
        main_deck: p.main.length,
        extra_deck: p.extra.length
      }))
    })

    this.piles.forEach(p => Object.values(p).forEach(q => q.refresh()))
  }

  step() {
    if (!this.ready) { return }

    this.emitter.update(1/60)
    let done = true
    for (const s of this.entities) {
      if (!s.task.next().done) {
        done = false
      }
    }

    if (done && this.index !== this.replay.messages.length) {
      const message = this.replay.messages[this.index++]
      this.duel.handle(message)
      return true
    }

    return false
  }
}

function lerp(p: number, f: number, t: number) {
  return p * (t - f) + f
}

export function isToPile(location: number) {
  const piles = LOCATION.DECK | LOCATION.GRAVE | LOCATION.EXTRA | LOCATION.REMOVED
  return !(location & LOCATION.OVERLAY) && (location & piles)
}
