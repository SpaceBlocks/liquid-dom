import { StrictMode, createRef, type ReactNode, type Ref } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Background,
  Frame,
  Glass,
  GlassContainer,
  HStack,
  Html,
  LayoutCanvas,
  Overlay,
  VStack,
  ZStack,
  useFrame,
  type GlassRef,
  type FrameRef,
  type HStackRef,
  type HtmlRef,
  type LayoutCanvasRef,
  type BackgroundRef,
  type GlassContainerRef,
  type OverlayRef,
  type VStackRef,
} from '../src/react'
import { flattenGlassHtml } from '../src/scene'

const rendererState = vi.hoisted(() => ({
  instances: [] as Array<{
    scene: unknown
    maxDpr: number
    canvas: HTMLCanvasElement
    render: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('../src/renderer', () => {
  class Renderer {
    scene: unknown
    maxDpr: number
    canvas = document.createElement('canvas')
    render = vi.fn()
    destroy = vi.fn()

    constructor(options: { scene?: unknown; maxDpr?: number } = {}) {
      this.scene = options.scene
      this.maxDpr = options.maxDpr ?? 2
      rendererState.instances.push(this)
    }
  }

  return { Renderer }
})

let frameCallbacks: Map<number, FrameRequestCallback>
let frameId: number

class TestResizeObserver {
  observe() {
    return
  }

  disconnect() {
    return
  }
}

beforeEach(() => {
  rendererState.instances.length = 0
  frameCallbacks = new Map()
  frameId = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frameId += 1
    frameCallbacks.set(frameId, callback)
    return frameId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frameCallbacks.delete(id)
  })
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

async function renderReact(element: ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await act(async () => undefined)

  return {
    container,
    root,
    async rerender(next: ReactNode) {
      await act(async () => {
        root.render(next)
      })
      await act(async () => undefined)
    },
    async unmount() {
      await act(async () => {
        root.unmount()
      })
    },
  }
}

function flushFrame(time = 16) {
  const callbacks = [...frameCallbacks.values()]
  frameCallbacks.clear()
  act(() => {
    for (const callback of callbacks) {
      callback(time)
    }
  })
}

function FixedHtml({
  htmlRef,
  width,
  height,
  children,
}: {
  htmlRef?: Ref<HtmlRef>
  width: number
  height: number
  children?: ReactNode
}) {
  return (
    <Frame width={width} height={height}>
      <Html ref={htmlRef} sizing="fill">
        {children}
      </Html>
    </Frame>
  )
}

describe('React layout components', () => {
  it('exposes refs and mirrors children in React order', async () => {
    const canvasRef = createRef<LayoutCanvasRef>()
    const containerRef = createRef<GlassContainerRef>()
    const rowRef = createRef<HStackRef>()
    const firstRef = createRef<GlassRef>()
    const secondRef = createRef<GlassRef>()

    await renderReact(
      <LayoutCanvas ref={canvasRef} frameloop="demand" proposal={{ width: 320, height: 200 }}>
        <GlassContainer ref={containerRef}>
          <HStack ref={rowRef} spacing={6}>
            <Glass ref={firstRef}>
              <FixedHtml width={10} height={10} />
            </Glass>
            <Glass ref={secondRef}>
              <FixedHtml width={20} height={10} />
            </Glass>
          </HStack>
        </GlassContainer>
      </LayoutCanvas>,
    )

    expect(canvasRef.current?.layoutScene.root).toBe(containerRef.current)
    expect(rowRef.current?.children).toEqual([firstRef.current, secondRef.current])
    expect(rendererState.instances[0]?.scene).toBe(canvasRef.current?.scene)
  })

  it('keeps child order stable through StrictMode effect replay', async () => {
    const rowRef = createRef<HStackRef>()
    const firstRef = createRef<GlassRef>()
    const secondRef = createRef<GlassRef>()

    await renderReact(
      <StrictMode>
        <LayoutCanvas frameloop="demand" proposal={{ width: 320, height: 200 }}>
          <GlassContainer>
            <HStack ref={rowRef}>
              <Glass ref={firstRef}>
                <FixedHtml width={10} height={10} />
              </Glass>
              <Glass ref={secondRef}>
                <FixedHtml width={20} height={10} />
              </Glass>
            </HStack>
          </GlassContainer>
        </LayoutCanvas>
      </StrictMode>,
    )

    expect(rowRef.current?.children).toEqual([firstRef.current, secondRef.current])
  })

  it('updates layout node props from React props', async () => {
    const columnRef = createRef<VStackRef>()
    const renderColumn = (spacing: number) => (
      <LayoutCanvas frameloop="demand" proposal={{ width: 320, height: 200 }}>
        <GlassContainer>
          <VStack ref={columnRef} spacing={spacing}>
            <Glass>
              <FixedHtml width={10} height={10} />
            </Glass>
          </VStack>
        </GlassContainer>
      </LayoutCanvas>
    )

    const view = await renderReact(renderColumn(8))
    expect(columnRef.current?.spacing).toBe(8)

    await view.rerender(renderColumn(24))
    expect(columnRef.current?.spacing).toBe(24)
  })

  it('mounts Html children into the layout Html element', async () => {
    const htmlRef = createRef<HtmlRef>()

    await renderReact(
      <LayoutCanvas frameloop="demand" proposal={{ width: 320, height: 200 }}>
        <ZStack>
          <FixedHtml htmlRef={htmlRef} width={40} height={20}>
            <span data-testid="inside-html">Hello</span>
          </FixedHtml>
        </ZStack>
      </LayoutCanvas>,
    )

    expect(htmlRef.current?.element).not.toBeNull()
    expect(htmlRef.current?.element).not.toBe(htmlRef.current?.sceneNode.host)
    expect(htmlRef.current?.element?.parentElement).toBe(htmlRef.current?.sceneNode.host)
    expect(htmlRef.current?.element?.style.width).toBe('100%')
    expect(htmlRef.current?.element?.style.height).toBe('100%')
    expect(htmlRef.current?.element?.style.display).toBe('block')
    expect(htmlRef.current?.element?.querySelector('[data-testid="inside-html"]')?.textContent).toBe('Hello')
  })

  it('schedules layout when Html is mutated through its retained ref', async () => {
    const htmlRef = createRef<HtmlRef>()

    await renderReact(
      <LayoutCanvas frameloop="demand" proposal={{ width: 320, height: 200 }}>
        <ZStack>
          <FixedHtml htmlRef={htmlRef} width={40} height={20} />
        </ZStack>
      </LayoutCanvas>,
    )
    flushFrame()

    const renderer = rendererState.instances[0]!
    renderer.render.mockClear()
    const replacement = document.createElement('div')

    act(() => {
      htmlRef.current?.setElement(replacement)
    })
    flushFrame(32)

    expect(htmlRef.current?.element).toBe(replacement)
    expect(renderer.render).toHaveBeenCalledTimes(1)
  })

  it('uses dedicated Overlay and Background decoration props', async () => {
    const overlayRef = createRef<OverlayRef>()
    const overlayContentFrameRef = createRef<FrameRef>()
    const overlayDecorationFrameRef = createRef<FrameRef>()
    const overlayContentRef = createRef<HtmlRef>()
    const overlayDecorationRef = createRef<HtmlRef>()
    const backgroundRef = createRef<BackgroundRef>()
    const backgroundContentFrameRef = createRef<FrameRef>()
    const backgroundDecorationFrameRef = createRef<FrameRef>()
    const backgroundContentRef = createRef<HtmlRef>()
    const backgroundDecorationRef = createRef<HtmlRef>()
    const glassRef = createRef<GlassRef>()

    await renderReact(
      <LayoutCanvas frameloop="demand" proposal={{ width: 320, height: 200 }}>
        <GlassContainer>
          <Glass ref={glassRef}>
            <VStack>
              <Overlay
                ref={overlayRef}
                overlay={
                  <Frame ref={overlayDecorationFrameRef} width={20} height={20}>
                    <Html ref={overlayDecorationRef} sizing="fill" />
                  </Frame>
                }
              >
                <Frame ref={overlayContentFrameRef} width={10} height={10}>
                  <Html ref={overlayContentRef} sizing="fill" />
                </Frame>
              </Overlay>
              <Background
                ref={backgroundRef}
                background={
                  <Frame ref={backgroundDecorationFrameRef} width={20} height={20}>
                    <Html ref={backgroundDecorationRef} sizing="fill" />
                  </Frame>
                }
              >
                <Frame ref={backgroundContentFrameRef} width={10} height={10}>
                  <Html ref={backgroundContentRef} sizing="fill" />
                </Frame>
              </Background>
            </VStack>
          </Glass>
        </GlassContainer>
      </LayoutCanvas>,
    )

    expect(overlayRef.current?.layoutNode.children).toEqual([
      overlayContentFrameRef.current?.layoutNode,
      overlayDecorationFrameRef.current?.layoutNode,
    ])
    expect(backgroundRef.current?.layoutNode.children).toEqual([
      backgroundContentFrameRef.current?.layoutNode,
      backgroundDecorationFrameRef.current?.layoutNode,
    ])
    expect(flattenGlassHtml(glassRef.current!.sceneNode).map((layer) => layer.html)).toEqual([
      overlayContentRef.current?.sceneNode,
      overlayDecorationRef.current?.sceneNode,
      backgroundDecorationRef.current?.sceneNode,
      backgroundContentRef.current?.sceneNode,
    ])
  })

  it('wires Glass pointer props and pointerEvents defaults', async () => {
    const glassRef = createRef<GlassRef>()
    const onClick = vi.fn()

    await renderReact(
      <LayoutCanvas frameloop="demand" proposal={{ width: 320, height: 200 }}>
        <GlassContainer>
          <Glass ref={glassRef} onClick={onClick}>
            <FixedHtml width={10} height={10} />
          </Glass>
        </GlassContainer>
      </LayoutCanvas>,
    )

    expect(glassRef.current?.pointerEvents).toBe(true)
    act(() => {
      glassRef.current?.sceneNode.dispatchEvent(new Event('click'))
    })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('runs useFrame callbacks in priority order and cleans them up', async () => {
    const calls: string[] = []
    const canvasRef = createRef<LayoutCanvasRef>()

    function Probe({ enabled }: { enabled: boolean }) {
      if (!enabled) {
        return null
      }

      return <FrameCallbacks calls={calls} />
    }

    function FrameCallbacks({ calls: target }: { calls: string[] }) {
      useFrame(() => target.push('late'), 10)
      useFrame(() => target.push('early'), -1)
      return null
    }

    const renderProbe = (enabled: boolean) => (
      <LayoutCanvas ref={canvasRef} frameloop="demand" proposal={{ width: 320, height: 200 }}>
        <ZStack>
          <Probe enabled={enabled} />
          <FixedHtml width={10} height={10} />
        </ZStack>
      </LayoutCanvas>
    )

    const view = await renderReact(renderProbe(true))
    flushFrame()
    expect(calls).toEqual(['early', 'late'])

    await view.rerender(renderProbe(false))
    canvasRef.current?.invalidateFrame()
    flushFrame(32)
    expect(calls).toEqual(['early', 'late'])
  })
})
