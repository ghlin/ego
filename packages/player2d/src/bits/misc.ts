export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export type Nullable<T> = T | null
export type Optional<T> = T | undefined

export function imageFromURL(url: string) {
  const image = new Image()
  return new Promise<HTMLImageElement>((phew, ooops) => {
    image.crossOrigin = 'anonymous'
    image.onload = () => phew(image)
    try {
      image.src = url
    } catch (e) {
      return ooops(e)
    }
  })
}

export function randomInt(fromInclusive: number, toExclusive: number) {
  return fromInclusive + Math.floor(Math.random() * toExclusive)
}

export function rpick<T>(candidates: Array<[T, number]>) {
  const total = candidates.reduce((t, a) => t + a[1], 0)
  const r = Math.random()
  let accu = 0
  for (const [v, p] of candidates) {
    const t = p / total + accu
    if (r <= t) { return v }
    accu = t
  }
  return candidates[candidates.length - 1][0]
}

export function request(method: string, url: string, prepare?: (req: XMLHttpRequest) => void) {
  return new Promise<string>((resolve, reject) => {
    const req = new XMLHttpRequest()
    req.addEventListener('load', res => resolve((res.target as any).responseText))
    req.addEventListener('error', reject)
    req.open(method, url)
    if (prepare) { prepare(req) }
    req.send()
  })
}
