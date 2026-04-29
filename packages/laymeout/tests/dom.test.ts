import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLayoutEngine, frame, hstack } from '../src/index'
import { domLeaf } from '../src/dom'

type ResizeObserverCallbackLike = (entries?: ResizeObserverEntry[]) => void

const resizeCallbacks: ResizeObserverCallbackLike[] = []
const originalResizeObserver = globalThis.ResizeObserver

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallbackLike) {
    resizeCallbacks.push(callback)
  }

  observe = vi.fn()
  disconnect = vi.fn()
}

describe('dom adapter', () => {
  beforeEach(() => {
    resizeCallbacks.splice(0)
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
    mockCloneIntrinsicSizes()
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver
    document.body.replaceChildren()
  })

  it('measures HTMLElement border boxes and writes retained node geometry', () => {
    const first = elementWithSize(30, 20)
    const second = elementWithSize(40, 10)
    document.body.append(first, second)
    const firstNode = domLeaf({ element: first })
    const secondNode = domLeaf({ element: second })
    const root = hstack({ spacing: 5, alignment: 'top' }, firstNode, secondNode)
    const engine = createLayoutEngine({ root })

    const stats = engine.layout({})

    expect(stats.nodes).toBe(3)
    expect(root.layout?.rect).toEqual({ x: 0, y: 0, width: 75, height: 20 })
    expect(firstNode.layout?.rect).toEqual({ x: 0, y: 0, width: 30, height: 20 })
    expect(secondNode.layout?.rect).toEqual({ x: 35, y: 0, width: 40, height: 10 })
  })

  it('measures through clones without mutating live elements', () => {
    const element = document.createElement('div')
    element.style.width = '72px'
    element.style.height = '24px'
    document.body.append(element)
    const node = domLeaf({ element })
    const engine = createLayoutEngine({ root: node })

    engine.layout({})

    expect(node.layout?.rect).toEqual({ x: 0, y: 0, width: 72, height: 24 })
    expect(element.style.position).toBe('')
    expect(element.style.transform).toBe('')
    expect(element.style.boxSizing).toBe('')
  })

  it('uses ResizeObserver invalidation for intrinsic DOM size changes', () => {
    const element = elementWithSize(30, 20)
    const onInvalidate = vi.fn()
    const leafNode = domLeaf({ element })
    const engine = createLayoutEngine({ root: leafNode, onInvalidate })
    engine.layout({})

    resizeCallbacks[0]?.([resizeEntry(42, 24)])

    expect(onInvalidate).toHaveBeenCalledWith({ id: leafNode.id, node: leafNode })
    expect(engine.getDebugStats().invalidations).toBe(1)
  })

  it('reuses DOM subscriptions when assigning the same retained leaf as root again', () => {
    const element = elementWithSize(30, 20)
    const node = domLeaf({ element })
    const engine = createLayoutEngine({ root: node })
    engine.layout({})
    engine.root = node

    expect(resizeCallbacks).toHaveLength(1)
    expect(engine.getDebugStats().activeSubscriptions).toBe(1)
  })

  it('supports proposal-width measurement', () => {
    const element = document.createElement('div')
    document.body.append(element)
    const node = domLeaf({ element, sizing: 'proposal-width' })
    const root = frame(node, { width: 50 })
    const engine = createLayoutEngine({ root })

    engine.layout({})

    expect(node.layout?.rect).toEqual({ x: 0, y: 0, width: 50, height: 80 })
    expect(element.style.width).toBe('')
  })

  it('remeasures proposal-width leaves when text content shrinks', () => {
    const element = document.createElement('div')
    element.textContent = 'long text'
    document.body.append(element)
    const node = domLeaf({ element, sizing: 'proposal-width' })
    const root = frame(node, { width: 50 })
    const engine = createLayoutEngine({ root })

    engine.layout({})
    expect(node.layout?.rect.height).toBe(80)

    element.textContent = 'short'
    node.invalidateMeasure('content')
    engine.layout({})
    expect(node.layout?.rect.height).toBe(32)
  })
})

function elementWithSize(width: number, height: number) {
  const element = document.createElement('div')
  element.style.width = `${width}px`
  element.style.height = `${height}px`
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => null,
    }) as DOMRect
  return element
}

function mockCloneIntrinsicSizes() {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      const element = this as HTMLElement
      if (element.style.height === 'auto' && element.style.width === '50px') {
        return element.textContent === 'short' ? 32 : 80
      }
      return Number.parseFloat(element.style.height) || 0
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return Number.parseFloat((this as HTMLElement).style.width) || 0
    },
  })
}

function resizeEntry(width: number, height: number): ResizeObserverEntry {
  return {
    contentRect: {
      width,
      height,
    },
  } as ResizeObserverEntry
}
