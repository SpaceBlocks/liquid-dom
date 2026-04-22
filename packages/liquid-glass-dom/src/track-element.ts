import {
  composeTransform,
  identityMatrix,
  invertMatrix,
  multiplyMatrices,
  transformPoint,
  type Matrix2D,
} from './matrix'
import { Container, Glass, Group, Scene } from './scene'
import type { Transform } from './types'
import type { Renderer } from './renderer'

export type TrackElementInit = {
  /** Renderer whose canvas defines the destination coordinate space. */
  renderer: Renderer
  /** External HTML element whose viewport rect should be tracked. */
  element: HTMLElement
  /** Glass shape whose local bounds should mirror the tracked element. */
  glass: Glass
}

export interface ElementTracker {
  /** Forces an immediate measurement and sync. */
  update(): void
  /** Stops future tracking updates and removes all observers/listeners. */
  disconnect(): void
}

type TrackingContext = {
  inverseContainerTransform: Matrix2D
}

const EPSILON = 0.000001

function isApproximately(value: number, expected: number) {
  return Math.abs(value - expected) <= EPSILON
}

function hasUnsupportedTrackingTransform(target: Transform) {
  return (
    !isApproximately(target.rotation, 0) ||
    !isApproximately(target.scaleX, 1) ||
    !isApproximately(target.scaleY, 1)
  )
}

function resolveTrackingContext(renderer: Renderer, glass: Glass): TrackingContext | null {
  if (hasUnsupportedTrackingTransform(glass)) {
    return null
  }

  const container = glass._parent
  if (!(container instanceof Container)) {
    return null
  }

  const chain: Array<Container | Group> = []
  let current: Container | Group | Scene | null = container

  while (current) {
    if (current instanceof Scene) {
      if (current !== renderer.scene) {
        return null
      }
      break
    }

    if (hasUnsupportedTrackingTransform(current)) {
      return null
    }

    chain.push(current)
    current = current._parent
  }

  if (!(current instanceof Scene)) {
    return null
  }

  let containerTransform = identityMatrix()
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    containerTransform = multiplyMatrices(containerTransform, composeTransform(chain[index]))
  }

  const inverseContainerTransform = invertMatrix(containerTransform)
  if (!inverseContainerTransform) {
    return null
  }

  return { inverseContainerTransform }
}

function assertTrackableSetup(renderer: Renderer, glass: Glass) {
  const container = glass._parent
  if (!(container instanceof Container)) {
    throw new Error('trackElement() requires a glass attached to a container in renderer.scene.')
  }

  let current: Container | Group | Scene | null = container
  let foundScene = false

  while (current) {
    if (current instanceof Scene) {
      foundScene = current === renderer.scene
      break
    }

    current = current._parent
  }

  if (!foundScene) {
    throw new Error('trackElement() requires a glass attached to a container in renderer.scene.')
  }

  if (!resolveTrackingContext(renderer, glass)) {
    throw new Error(
      'trackElement() only supports unscaled, unrotated glasses inside translation-only container and group ancestors.',
    )
  }
}

class ElementTrackerController implements ElementTracker {
  private readonly resizeObserver: ResizeObserver
  private readonly visualViewport = window.visualViewport
  private readonly unsubscribeSceneMutations: () => void

  private rafId = 0
  private disconnected = false
  private applyingSync = false

  private readonly handleAsyncInvalidation = () => {
    if (this.applyingSync || this.disconnected) {
      return
    }

    this.scheduleUpdate()
  }

  constructor(
    private readonly renderer: Renderer,
    private readonly element: HTMLElement,
    private readonly glass: Glass,
  ) {
    assertTrackableSetup(renderer, glass)

    this.resizeObserver = new ResizeObserver(this.handleAsyncInvalidation)
    this.resizeObserver.observe(element)
    this.resizeObserver.observe(renderer.canvas)

    window.addEventListener('resize', this.handleAsyncInvalidation)
    window.addEventListener('scroll', this.handleAsyncInvalidation, true)
    this.visualViewport?.addEventListener('resize', this.handleAsyncInvalidation)
    this.visualViewport?.addEventListener('scroll', this.handleAsyncInvalidation)
    this.unsubscribeSceneMutations = renderer.scene._subscribe(this.handleAsyncInvalidation)

    this.update()
  }

  update() {
    if (this.disconnected) {
      return
    }

    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }

    this.syncNow()
  }

  disconnect() {
    if (this.disconnected) {
      return
    }

    this.disconnected = true

    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }

    this.resizeObserver.disconnect()
    this.unsubscribeSceneMutations()
    window.removeEventListener('resize', this.handleAsyncInvalidation)
    window.removeEventListener('scroll', this.handleAsyncInvalidation, true)
    this.visualViewport?.removeEventListener('resize', this.handleAsyncInvalidation)
    this.visualViewport?.removeEventListener('scroll', this.handleAsyncInvalidation)
  }

  private scheduleUpdate() {
    if (this.rafId !== 0 || this.disconnected) {
      return
    }

    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0
      this.syncNow()
    })
  }

  private syncNow() {
    const context = resolveTrackingContext(this.renderer, this.glass)
    if (!context) {
      return
    }

    const canvasRect = this.renderer.canvas.getBoundingClientRect()
    const elementRect = this.element.getBoundingClientRect()
    const localTopLeft = transformPoint(
      context.inverseContainerTransform,
      elementRect.left - canvasRect.left,
      elementRect.top - canvasRect.top,
    )

    this.applyingSync = true
    try {
      this.glass.x = localTopLeft.x
      this.glass.y = localTopLeft.y
      this.glass.width = elementRect.width
      this.glass.height = elementRect.height
    } finally {
      this.applyingSync = false
    }
  }
}

export function trackElement(init: TrackElementInit): ElementTracker {
  return new ElementTrackerController(init.renderer, init.element, init.glass)
}
