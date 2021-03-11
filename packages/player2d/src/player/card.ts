import { ClientCard } from '@ego/duel-client/src/index'
import * as Pixi from 'pixi.js'
import { Assets } from './assets'
import { POS } from '@ego/message-protocol'
import { MotionBlurFilter } from '@pixi/filter-motion-blur'
import { GlowFilter } from '@pixi/filter-glow'

export type Entity = ClientCard<ClientData>

export class ClientData {
  isMoving = false

  container = new Pixi.Container()
  sprite: Pixi.Sprite
  front: Pixi.Texture
  back: Pixi.Texture
  task: Generator<void, void, unknown> = (function *() { return })()
  motionEffect = new MotionBlurFilter(new Pixi.Point(0, 0))
  glowEffect = new GlowFilter()

  constructor(readonly assets: Assets) {
    this.sprite = new Pixi.Sprite()
    this.front  = new Pixi.Texture(new Pixi.BaseTexture(assets.textures.unknown))
    this.back   = new Pixi.Texture(new Pixi.BaseTexture(assets.textures.cover))

    this.motionEffect.enabled    = false
    this.motionEffect.kernelSize = 5
    this.motionEffect.offset     = 0

    this.glowEffect.color   = 0x555555
    this.glowEffect.enabled = false

    const area = new Pixi.Graphics()

    const range = 500
    area.width  = range
    area.height = range

    this.container.addChild(area)
    this.container.addChild(this.sprite)

    this.container.filters = [this.motionEffect]
    this.sprite.filters    = [this.glowEffect]
  }

  setFace(pos: number) {
    if (pos & POS.FACEUP) {
      this.sprite.texture = this.front
    } else {
      this.sprite.texture = this.back
    }
  }

  setCode(code: number) {
    const image = this.assets.images.get(code) ?? this.assets.textures.unknown
    this.front  = new Pixi.Texture(new Pixi.BaseTexture(image))
  }

  public set timeline(produce: () => Generator<void, void, unknown>) {
    const a = this.task
    const b = produce()

    function *composed() {
      while (true) {
        const ra = a.next()
        const rb = b.next()

        if (ra.done && rb.done) { break }
        else { yield }
      }
    }

    this.task = composed()
  }
}
