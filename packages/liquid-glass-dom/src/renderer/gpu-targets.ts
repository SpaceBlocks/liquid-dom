import { GPU_TEXTURE_USAGE } from './gpu-constants'

export type RenderTargetSet = {
  blurPing: GPUTexture
  blur: GPUTexture
  sceneA: GPUTexture
  sceneB: GPUTexture
}

export type TextureCopyRegion = {
  sourceX: number
  sourceY: number
  destinationX: number
  destinationY: number
  width: number
  height: number
}

export function createRenderTarget(
  device: GPUDevice,
  format: GPUTextureFormat,
  width: number,
  height: number,
) {
  return device.createTexture({
    size: {
      width,
      height,
      depthOrArrayLayers: 1,
    },
    format,
    usage:
      GPU_TEXTURE_USAGE.COPY_SRC |
      GPU_TEXTURE_USAGE.TEXTURE_BINDING |
      GPU_TEXTURE_USAGE.RENDER_ATTACHMENT |
      GPU_TEXTURE_USAGE.COPY_DST,
  })
}

export function destroyTargets(targets: RenderTargetSet | null) {
  if (!targets) {
    return
  }

  targets.blurPing.destroy()
  targets.blur.destroy()
  targets.sceneA.destroy()
  targets.sceneB.destroy()
}

export function copyTextureRegion(
  encoder: GPUCommandEncoder,
  source: GPUTexture,
  destination: GPUTexture,
  region: TextureCopyRegion,
) {
  const width = Math.floor(region.width)
  const height = Math.floor(region.height)

  if (width <= 0 || height <= 0) {
    return false
  }

  encoder.copyTextureToTexture(
    {
      texture: source,
      origin: {
        x: Math.floor(region.sourceX),
        y: Math.floor(region.sourceY),
        z: 0,
      },
    },
    {
      texture: destination,
      origin: {
        x: Math.floor(region.destinationX),
        y: Math.floor(region.destinationY),
        z: 0,
      },
    },
    {
      width,
      height,
      depthOrArrayLayers: 1,
    },
  )

  return true
}
