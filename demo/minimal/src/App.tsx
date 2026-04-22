import { startTransition, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Container,
  Glass,
  Group,
  type GlassPointerEvent,
  Renderer,
  Scene,
} from 'liquid-glass-dom'
import { trackElement, type ElementTracker } from 'liquid-glass-dom/track-element'
import './App.css'

type DemoTab = 'pointer' | 'tracker' | 'flex'

type EventRow = {
  id: number
  message: string
}

type LiveState = {
  glass: string
  type: string
  localX: number
  localY: number
  inside: boolean
}

type GlassFrame = {
  x: number
  y: number
  width: number
  height: number
}

type TrackedOutline = {
  x: number
  y: number
  width: number
  height: number
}

type DragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  originX: number
  originY: number
}

const MAX_LOG_ROWS = 10

function formatPointerEvent(label: string, event: GlassPointerEvent) {
  return `${label} ${event.type} local(${event.localX.toFixed(1)}, ${event.localY.toFixed(1)}) inside=${event.inside}`
}

function PointerEventsDemo() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [latestEvent, setLatestEvent] = useState<LiveState | null>(null)
  const [eventLog, setEventLog] = useState<EventRow[]>([])

  useEffect(() => {
    const mount = stageRef.current
    if (!mount) {
      return
    }

    const scene = new Scene()

    const baseContainer = new Container({
      x: 72,
      y: 76,
      blur: 7,
      spacing: 24,
      bezelWidth: 18,
      thickness: 90,
      zIndex: 0,
    })

    const leftGlass = new Glass({
      x: 0,
      y: 0,
      width: 240,
      height: 160,
      cornerRadius: 52,
      pointerEvents: false,
      zIndex: 0,
    })

    const rightGlass = new Glass({
      x: 150,
      y: 92,
      width: 260,
      height: 180,
      cornerRadius: 58,
      pointerEvents: true,
      zIndex: 1,
    })

    baseContainer.add(leftGlass)
    baseContainer.add(rightGlass)

    const topContainer = new Container({
      x: 280,
      y: 90,
      blur: 6,
      spacing: 18,
      bezelWidth: 16,
      thickness: 70,
      tint: { r: 0.11, g: 0.18, b: 0.18, a: 0.64 },
      zIndex: 1,
    })

    const topGlass = new Glass({
      x: 0,
      y: 0,
      width: 220,
      height: 132,
      cornerRadius: 42,
      pointerEvents: true,
      zIndex: 0,
    })
    topContainer.add(topGlass)

    scene.add(baseContainer)
    scene.add(topContainer)

    const renderer = new Renderer({ scene })
    renderer.canvas.className = 'demo-canvas'
    mount.append(renderer.canvas)

    renderer.htmlRoot.innerHTML = `
      <div class="backdrop-grid">
        <section class="backdrop-card">
          <span class="eyebrow">minimal demo</span>
          <h1>Glass Pointer Events</h1>
          <p>Move through the overlapping shapes to verify per-glass hit testing and container-layer precedence.</p>
        </section>
        <section class="backdrop-card alt">
          <p>Expected checks:</p>
          <ul>
            <li>Same-container overlap resolves via glass z-index.</li>
            <li>Higher container layers win across containers.</li>
            <li>The left glass has pointer events disabled and should stay inert.</li>
            <li>Glass events still fire over DOM content hosted inside a glass.</li>
          </ul>
        </section>
      </div>
    `

    const glassButton = document.createElement('button')
    glassButton.className = 'glass-button'
    glassButton.type = 'button'
    glassButton.textContent = 'Native button inside glass'
    glassButton.addEventListener('click', () => {
      startTransition(() => {
        setEventLog((rows) => [
          { id: Date.now(), message: 'native button click' },
          ...rows,
        ].slice(0, MAX_LOG_ROWS))
      })
    })
    topGlass.setContent(glassButton)

    let nextLogId = 1
    const trackedGlasses = [
      { glass: leftGlass, label: 'left' },
      { glass: rightGlass, label: 'right' },
      { glass: topGlass, label: 'top' },
    ] as const

    const removeListeners = trackedGlasses.flatMap(({ glass, label }) => {
      return [
        'click',
        'pointerenter',
        'pointerleave',
        'pointermove',
        'pointerdown',
        'pointerup',
        'pointercancel',
      ].map((type) => {
        const listener = (event: Event) => {
          const pointerEvent = event as GlassPointerEvent
          startTransition(() => {
            setLatestEvent({
              glass: label,
              type: pointerEvent.type,
              localX: pointerEvent.localX,
              localY: pointerEvent.localY,
              inside: pointerEvent.inside,
            })

            if (pointerEvent.type !== 'pointermove') {
              setEventLog((rows) => [
                { id: nextLogId++, message: formatPointerEvent(label, pointerEvent) },
                ...rows,
              ].slice(0, MAX_LOG_ROWS))
            }
          })
        }

        glass.addEventListener(type, listener)
        return () => glass.removeEventListener(type, listener)
      })
    })

    let frameId = 0
    const frame = () => {
      renderer.render()
      frameId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(frameId)
      for (const removeListener of removeListeners) {
        removeListener()
      }
      renderer.destroy()
      glassButton.remove()
    }
  }, [])

  return (
    <section className="demo-layout">
      <div ref={stageRef} className="canvas-shell" />

      <aside className="inspector">
        <div className="panel">
          <h2>Latest event</h2>
          {latestEvent ? (
            <dl className="metric-grid">
              <div>
                <dt>glass</dt>
                <dd>{latestEvent.glass}</dd>
              </div>
              <div>
                <dt>type</dt>
                <dd>{latestEvent.type}</dd>
              </div>
              <div>
                <dt>local x</dt>
                <dd>{latestEvent.localX.toFixed(1)}</dd>
              </div>
              <div>
                <dt>local y</dt>
                <dd>{latestEvent.localY.toFixed(1)}</dd>
              </div>
              <div>
                <dt>inside</dt>
                <dd>{String(latestEvent.inside)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Interact with a glass shape to populate this panel.</p>
          )}
        </div>

        <div className="panel">
          <h2>Recent events</h2>
          <ol className="event-log">
            {eventLog.length > 0 ? (
              eventLog.map((row) => <li key={row.id}>{row.message}</li>)
            ) : (
              <li className="muted">No events yet.</li>
            )}
          </ol>
        </div>
      </aside>
    </section>
  )
}

function TrackerDemo() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const sourceOutlineRef = useRef<HTMLDivElement | null>(null)
  const trackerRef = useRef<ElementTracker | null>(null)
  const dragStateRef = useRef<DragState | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [trackedOutline, setTrackedOutline] = useState<TrackedOutline>({
    x: 78,
    y: 112,
    width: 224,
    height: 148,
  })
  const [glassFrame, setGlassFrame] = useState<GlassFrame>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })

  useEffect(() => {
    const mount = stageRef.current
    const sourceOutline = sourceOutlineRef.current
    if (!mount || !sourceOutline) {
      return
    }

    const scene = new Scene()

    const translatedGroup = new Group({
      x: 56,
      y: 48,
    })

    const container = new Container({
      x: 82,
      y: 58,
      blur: 7,
      spacing: 20,
      bezelWidth: 18,
      thickness: 88,
      tint: { r: 0.12, g: 0.16, b: 0.21, a: 0.58 },
    })

    const trackedGlass = new Glass({
      width: 180,
      height: 120,
      cornerRadius: 28,
      pointerEvents: true,
    })

    const labelGlass = new Glass({
      x: 42,
      y: 50,
      width: 220,
      height: 168,
      cornerRadius: 36,
      pointerEvents: true,
    })

    const overlayContainer = new Container({
      x: 494,
      y: 137,
      blur: 6,
      spacing: 18,
      bezelWidth: 16,
      thickness: 72,
      tint: { r: 0.18, g: 0.22, b: 0.26, a: 0.52 },
      zIndex: 1,
    })

    const overlayGlass = new Glass({
      x: 0,
      y: 0,
      width: 180,
      height: 110,
      cornerRadius: 32,
    })

    const dragLabel = document.createElement('div')
    dragLabel.className = 'drag-me-label'
    dragLabel.textContent = 'drag me'
    trackedGlass.setContent(dragLabel)

    container.add(trackedGlass)
    container.add(labelGlass)
    overlayContainer.add(overlayGlass)
    translatedGroup.add(container)
    translatedGroup.add(overlayContainer)
    scene.add(translatedGroup)

    const renderer = new Renderer({ scene })
    renderer.canvas.className = 'demo-canvas'
    mount.append(renderer.canvas)

    renderer.htmlRoot.innerHTML = `
      <div class="tracker-backdrop">
        <div class="tracker-grid"></div>
        <div class="tracker-glow tracker-glow-a"></div>
        <div class="tracker-glow tracker-glow-b"></div>
      </div>
    `

    trackerRef.current = trackElement({
      renderer,
      element: sourceOutline,
      glass: trackedGlass,
    })

    let frameId = 0
    const frame = () => {
      renderer.render()
      setGlassFrame({
        x: trackedGlass.x,
        y: trackedGlass.y,
        width: trackedGlass.width,
        height: trackedGlass.height,
      })
      frameId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(frameId)
      trackerRef.current?.disconnect()
      trackerRef.current = null
      renderer.destroy()
      dragLabel.remove()
    }
  }, [])

  useEffect(() => {
    trackerRef.current?.update()
  }, [trackedOutline])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: trackedOutline.x,
      originY: trackedOutline.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    setTrackedOutline((current) => ({
      ...current,
      x: dragState.originX + (event.clientX - dragState.startClientX),
      y: dragState.originY + (event.clientY - dragState.startClientY),
    }))
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
  }

  return (
    <section className="tracker-layout">
      <div className="tracker-main">
        <div className="panel tracker-controls-panel">
          <div className="tracker-controls">
            <label className="tracker-toggle">
              <input
                type="checkbox"
                checked={overlayVisible}
                onChange={(event) => setOverlayVisible(event.target.checked)}
              />
              <span>Show overlay</span>
            </label>

            <div className="tracker-control">
              <label htmlFor="tracker-width">outline width</label>
              <input
                id="tracker-width"
                type="range"
                min="140"
                max="360"
                value={trackedOutline.width}
                onChange={(event) => {
                  const width = Number(event.target.value)
                  setTrackedOutline((current) => ({ ...current, width }))
                }}
              />
              <span>{trackedOutline.width}px</span>
            </div>

            <div className="tracker-control">
              <label htmlFor="tracker-height">outline height</label>
              <input
                id="tracker-height"
                type="range"
                min="100"
                max="280"
                value={trackedOutline.height}
                onChange={(event) => {
                  const height = Number(event.target.value)
                  setTrackedOutline((current) => ({ ...current, height }))
                }}
              />
              <span>{trackedOutline.height}px</span>
            </div>
          </div>

          <div className="tracker-actions">
            <p className="muted">
              The red outline is the tracked DOM element. Drag it anywhere inside the stage and the large
              glass should match it immediately.
            </p>
            <p className="muted">
              Hide the overlay when you want to inspect the tracked glass by itself without the source marker
              on top.
            </p>
          </div>
        </div>

        <div className="tracker-stage-shell">
          <div className={overlayVisible ? 'tracker-source-layer' : 'tracker-source-layer hidden'}>
            <div
              ref={sourceOutlineRef}
              className={
                isDragging ? 'tracker-outline dragging' : 'tracker-outline'
              }
              style={{
                left: `${trackedOutline.x}px`,
                top: `${trackedOutline.y}px`,
                width: `${trackedOutline.width}px`,
                height: `${trackedOutline.height}px`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            />
          </div>

          <div className="canvas-shell tracker-canvas-shell" ref={stageRef} />
        </div>
      </div>

      <aside className="inspector">
        <div className="panel">
          <h2>Tracked glass frame</h2>
          <dl className="metric-grid">
            <div>
              <dt>x</dt>
              <dd>{glassFrame.x.toFixed(1)}</dd>
            </div>
            <div>
              <dt>y</dt>
              <dd>{glassFrame.y.toFixed(1)}</dd>
            </div>
            <div>
              <dt>width</dt>
              <dd>{glassFrame.width.toFixed(1)}</dd>
            </div>
            <div>
              <dt>height</dt>
              <dd>{glassFrame.height.toFixed(1)}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2>Checks</h2>
          <ul className="check-list">
            <li>The large glass should outline the red source rectangle.</li>
            <li>Dragging the red outline should move the glass immediately.</li>
            <li>The label glass should stay fixed so you can compare the tracked one against it.</li>
            <li>The tracked element remains outside the canvas even though it shares the same stage area.</li>
          </ul>
        </div>
      </aside>
    </section>
  )
}

function FlexTrackerDemo() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const flexBoxRef = useRef<HTMLDivElement | null>(null)
  const childRefs = [
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
    useRef<HTMLDivElement | null>(null),
  ] as const
  const trackerRefs = useRef<Array<ElementTracker | null>>([])
  const dragStateRef = useRef<DragState | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [flexBox, setFlexBox] = useState<TrackedOutline>({
    x: 72,
    y: 124,
    width: 360,
    height: 176,
  })
  const [glassFrames, setGlassFrames] = useState<GlassFrame[]>([
    { x: 0, y: 0, width: 0, height: 0 },
    { x: 0, y: 0, width: 0, height: 0 },
    { x: 0, y: 0, width: 0, height: 0 },
  ])

  useEffect(() => {
    const mount = stageRef.current
    const flexBoxElement = flexBoxRef.current
    const childElements = childRefs.map((ref) => ref.current)
    if (!mount || !flexBoxElement || childElements.some((element) => !element)) {
      return
    }

    const scene = new Scene()

    const translatedGroup = new Group({
      x: 48,
      y: 42,
    })

    const container = new Container({
      x: 78,
      y: 62,
      blur: 7,
      spacing: 22,
      bezelWidth: 18,
      thickness: 90,
      tint: { r: 0.11, g: 0.16, b: 0.22, a: 0.56 },
    })

    const trackedGlasses = [
      new Glass({ width: 80, height: 120, cornerRadius: 30 }),
      new Glass({ width: 80, height: 120, cornerRadius: 30 }),
      new Glass({ width: 80, height: 120, cornerRadius: 30 }),
    ]

    const labelGlass = new Glass({
      x: 54,
      y: 46,
      width: 220,
      height: 180,
      cornerRadius: 34,
      pointerEvents: true,
    })

    const overlayContainer = new Container({
      x: 502,
      y: 146,
      blur: 6,
      spacing: 16,
      bezelWidth: 16,
      thickness: 70,
      tint: { r: 0.18, g: 0.22, b: 0.26, a: 0.52 },
      zIndex: 1,
    })

    const overlayGlass = new Glass({
      x: 0,
      y: 0,
      width: 164,
      height: 104,
      cornerRadius: 30,
    })

    const dragLabels = trackedGlasses.map(() => {
      const label = document.createElement('div')
      label.className = 'drag-me-label'
      label.textContent = 'drag me'
      return label
    })

    for (let index = 0; index < trackedGlasses.length; index += 1) {
      trackedGlasses[index].setContent(dragLabels[index])
    }

    for (const glass of trackedGlasses) {
      container.add(glass)
    }
    container.add(labelGlass)
    overlayContainer.add(overlayGlass)
    translatedGroup.add(container)
    translatedGroup.add(overlayContainer)
    scene.add(translatedGroup)

    const renderer = new Renderer({ scene })
    renderer.canvas.className = 'demo-canvas'
    mount.append(renderer.canvas)

    renderer.htmlRoot.innerHTML = `
      <div class="tracker-backdrop">
        <div class="tracker-grid"></div>
        <div class="tracker-glow tracker-glow-a"></div>
        <div class="tracker-glow tracker-glow-b"></div>
      </div>
    `

    trackerRefs.current = childElements.map((element, index) =>
      trackElement({
        renderer,
        element: element!,
        glass: trackedGlasses[index],
      }),
    )

    let frameId = 0
    const frame = () => {
      renderer.render()
      setGlassFrames(
        trackedGlasses.map((glass) => ({
          x: glass.x,
          y: glass.y,
          width: glass.width,
          height: glass.height,
        })),
      )
      frameId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(frameId)
      for (const tracker of trackerRefs.current) {
        tracker?.disconnect()
      }
      trackerRefs.current = []
      renderer.destroy()
      for (const label of dragLabels) {
        label.remove()
      }
    }
  }, [])

  useEffect(() => {
    for (const tracker of trackerRefs.current) {
      tracker?.update()
    }
  }, [flexBox])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: flexBox.x,
      originY: flexBox.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    setFlexBox((current) => ({
      ...current,
      x: dragState.originX + (event.clientX - dragState.startClientX),
      y: dragState.originY + (event.clientY - dragState.startClientY),
    }))
  }

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
  }

  return (
    <section className="tracker-layout">
      <div className="tracker-main">
        <div className="panel tracker-controls-panel">
          <div className="tracker-controls">
            <label className="tracker-toggle">
              <input
                type="checkbox"
                checked={overlayVisible}
                onChange={(event) => setOverlayVisible(event.target.checked)}
              />
              <span>Show overlay</span>
            </label>

            <div className="tracker-control">
              <label htmlFor="flex-width">flex width</label>
              <input
                id="flex-width"
                type="range"
                min="240"
                max="520"
                value={flexBox.width}
                onChange={(event) => {
                  const width = Number(event.target.value)
                  setFlexBox((current) => ({ ...current, width }))
                }}
              />
              <span>{flexBox.width}px</span>
            </div>

            <div className="tracker-control">
              <label htmlFor="flex-height">flex height</label>
              <input
                id="flex-height"
                type="range"
                min="120"
                max="260"
                value={flexBox.height}
                onChange={(event) => {
                  const height = Number(event.target.value)
                  setFlexBox((current) => ({ ...current, height }))
                }}
              />
              <span>{flexBox.height}px</span>
            </div>
          </div>

          <div className="tracker-actions">
            <p className="muted">
              The red outer box is a flex container with `justify-content: space-between` and `align-items:
              stretch`. Drag the whole box around the stage and each child glass should follow.
            </p>
            <p className="muted">
              Width and height changes should redistribute the flex children, and the three tracked glasses
              should update to match the new child layout.
            </p>
          </div>
        </div>

        <div className="tracker-stage-shell">
          <div className={overlayVisible ? 'tracker-source-layer' : 'tracker-source-layer hidden'}>
            <div
              ref={flexBoxRef}
              className={isDragging ? 'flex-overlay dragging' : 'flex-overlay'}
              style={{
                left: `${flexBox.x}px`,
                top: `${flexBox.y}px`,
                width: `${flexBox.width}px`,
                height: `${flexBox.height}px`,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
            >
              <div ref={childRefs[0]} className="flex-overlay-child child-a" />
              <div ref={childRefs[1]} className="flex-overlay-child child-b" />
              <div ref={childRefs[2]} className="flex-overlay-child child-c" />
            </div>
          </div>

          <div className="canvas-shell tracker-canvas-shell" ref={stageRef} />
        </div>
      </div>

      <aside className="inspector">
        <div className="panel">
          <h2>Tracked children</h2>
          <dl className="metric-grid">
            <div>
              <dt>left width</dt>
              <dd>{glassFrames[0].width.toFixed(1)}</dd>
            </div>
            <div>
              <dt>middle width</dt>
              <dd>{glassFrames[1].width.toFixed(1)}</dd>
            </div>
            <div>
              <dt>right width</dt>
              <dd>{glassFrames[2].width.toFixed(1)}</dd>
            </div>
            <div>
              <dt>child height</dt>
              <dd>{glassFrames[0].height.toFixed(1)}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <h2>Checks</h2>
          <ul className="check-list">
            <li>Each glass should align to one flex child.</li>
            <li>Dragging the red flex box should move all three glasses together.</li>
            <li>Changing the flex width should change the gaps while keeping children stretched.</li>
            <li>Changing the flex height should stretch all three children vertically.</li>
          </ul>
        </div>
      </aside>
    </section>
  )
}

export default function App() {
  const [activeDemo, setActiveDemo] = useState<DemoTab>('pointer')

  return (
    <main className="minimal-app">
      <div className="app-shell">
        <aside className="demo-sidebar">
          <div className="demo-tabs" role="tablist" aria-orientation="vertical">
            <button
              type="button"
              role="tab"
              aria-selected={activeDemo === 'pointer'}
              className={activeDemo === 'pointer' ? 'demo-tab active' : 'demo-tab'}
              onClick={() => setActiveDemo('pointer')}
            >
              <span>Pointer events</span>
              <small>Per-glass hit testing and DOM coexistence</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDemo === 'tracker'}
              className={activeDemo === 'tracker' ? 'demo-tab active' : 'demo-tab'}
              onClick={() => setActiveDemo('tracker')}
            >
              <span>Track element</span>
              <small>Mirror an external DOM rect into glass bounds</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDemo === 'flex'}
              className={activeDemo === 'flex' ? 'demo-tab active' : 'demo-tab'}
              onClick={() => setActiveDemo('flex')}
            >
              <span>Track flex children</span>
              <small>Track three space-between flex items at once</small>
            </button>
          </div>
        </aside>

        <section className="demo-content">
          {activeDemo === 'pointer' ? <PointerEventsDemo /> : activeDemo === 'tracker' ? <TrackerDemo /> : <FlexTrackerDemo />}
        </section>
      </div>
    </main>
  )
}
