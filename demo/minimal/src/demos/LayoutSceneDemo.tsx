import { useEffect, useRef, useState } from 'react'
import { Renderer } from 'liquid-glass-dom'
import {
  Background,
  Frame,
  Glass,
  GlassContainer,
  HStack,
  Html,
  LayoutScene,
  Overlay,
  Padding,
  Spacer,
  Transform,
  VStack,
  ZStack,
} from 'liquid-glass-dom/layout'

const SURFACE_WIDTH = 720
const SURFACE_HEIGHT = 430
const INITIAL_COLUMN_GAP = 20
const INITIAL_ROW_GAP = 18
const INITIAL_PADDING = 28
const INITIAL_FRAME_WIDTH = 238
const INITIAL_FRAME_HEIGHT = 150
const INITIAL_TRANSFORM_OFFSET = 28

type LayoutRefs = {
  scene: LayoutScene
  column: VStack
  row: HStack
  padding: Padding
  primaryFrame: Frame
  secondaryFrame: Frame
  footerFrame: Frame
  featureTransform: Transform
}

function fillHtml(element: HTMLElement) {
  return new Html({
    element,
    sizing: 'fill',
  })
}

function fixedHtml(width: number, height: number, className: string, html: string) {
  const frame = new Frame({
    height,
    width,
  })
  frame.add(new Html({
    element: createElement(className, html),
    sizing: 'fill',
  }))
  return frame
}

function createElement(className: string, html: string) {
  const element = document.createElement('div')
  element.className = className
  element.innerHTML = html
  return element
}

function addHeader(glass: Glass) {
  const padding = glass.add(new Padding({ insets: { horizontal: 22, vertical: 14 } }))
  const row = padding.add(new HStack({ spacing: 12, alignment: 'center' }))

  row.add(fixedHtml(
    200,
    42,
    'layout-chip',
    `
      <span>Spacer</span>
      <strong>Header row</strong>
    `,
  ))
  row.add(new Spacer({ minLength: 18 }))
  row.add(fixedHtml(
    142,
    42,
    'layout-chip metric',
    `
      <span>Layout</span>
      <strong>live</strong>
    `,
  ))
}

function addPrimaryPanel(glass: Glass) {
  const overlay = glass.add(new Overlay({ alignment: 'topTrailing' }))

  overlay.add(fillHtml(createElement(
    'layout-glass-card primary',
    `
      <span>Overlay</span>
      <strong>Primary frame</strong>
      <p>The width and height sliders resize this glass through its Frame.</p>
    `,
  )))

  const badgeFrame = overlay.add(new Frame({
    width: 104,
    height: 34,
    alignment: 'topTrailing',
  }))
  badgeFrame.add(fixedHtml(
    104,
    34,
    'layout-overlay-badge',
    '<strong>Overlay</strong>',
  ))
}

function addBackgroundPanel(glass: Glass) {
  const background = glass.add(new Background({ alignment: 'center' }))

  background.add(fillHtml(createElement(
    'layout-glass-card compact',
    `
      <span>Background</span>
      <strong>Underlay stays behind this text</strong>
    `,
  )))

  background.add(fillHtml(createElement(
    'layout-underlay',
    '<div></div><div></div><div></div>',
  )))
}

function addFooter(glass: Glass) {
  const padding = glass.add(new Padding({ insets: { horizontal: 20, vertical: 14 } }))
  const row = padding.add(new HStack({ spacing: 14, alignment: 'center' }))

  row.add(fixedHtml(
    170,
    42,
    'layout-chip',
    `
      <span>VStack</span>
      <strong>Footer</strong>
    `,
  ))
  row.add(new Spacer({ minLength: 12 }))
  row.add(fixedHtml(
    210,
    42,
    'layout-chip metric',
    `
      <span>Padding</span>
      <strong>moves the subtree</strong>
    `,
  ))
}

function buildLayoutScene(): LayoutRefs {
  const scene = new LayoutScene()
  const root = scene.add(new ZStack({ alignment: 'center' }))

  const backdrop = root.add(fillHtml(createElement(
    'layout-backdrop',
    `
      <div class="layout-backdrop-copy">
        <span class="eyebrow">layout scene</span>
        <h1>SwiftUI-style layout over glass</h1>
        <p>This tab combines frames, stacks, padding, spacers, z-stacking, background, overlay, and transform groups.</p>
      </div>
    `,
  )))
  backdrop.zIndex = -1

  const surfaceFrame = root.add(new Frame({
    width: SURFACE_WIDTH,
    height: SURFACE_HEIGHT,
    alignment: 'topLeading',
  }))
  const container = surfaceFrame.add(new GlassContainer({
    blur: 10,
    spacing: 28,
    bezelWidth: 18,
    thickness: 90,
    contentDepth: 18,
    tint: { r: 0.1, g: 0.17, b: 0.18, a: 0.64 },
    zIndex: 1,
  }))

  const padding = container.add(new Padding({ insets: INITIAL_PADDING }))
  const column = padding.add(new VStack({ spacing: INITIAL_COLUMN_GAP, alignment: 'center' }))

  const headerFrame = column.add(new Frame({
    maxWidth: 'infinity',
    height: 72,
    alignment: 'center',
  }))
  const headerGlass = headerFrame.add(new Glass({
    cornerRadius: 28,
    pointerEvents: true,
  }))
  addHeader(headerGlass)

  const row = column.add(new HStack({ spacing: INITIAL_ROW_GAP }))

  const primaryFrame = row.add(new Frame({
    width: INITIAL_FRAME_WIDTH,
    height: INITIAL_FRAME_HEIGHT,
    alignment: 'center',
  }))
  const primaryGlass = primaryFrame.add(new Glass({
    cornerRadius: 42,
    pointerEvents: true,
  }))
  addPrimaryPanel(primaryGlass)

  row.add(new Spacer({ minLength: 24 }))

  const secondaryFrame = row.add(new Frame({
    width: 244,
    height: INITIAL_FRAME_HEIGHT,
    alignment: 'center',
  }))
  const stack = secondaryFrame.add(new ZStack({ alignment: 'center' }))
  const backgroundFrame = stack.add(new Frame({
    width: 244,
    height: 126,
    alignment: 'center',
  }))
  const backgroundGlass = backgroundFrame.add(new Glass({
    cornerRadius: 36,
    pointerEvents: true,
  }))
  addBackgroundPanel(backgroundGlass)

  const featureTransform = stack.add(new Transform({
    x: INITIAL_TRANSFORM_OFFSET,
    y: -18,
    rotation: -0.08,
    origin: { x: 52, y: 42 },
  }))
  const featureFrame = featureTransform.add(new Frame({
    width: 112,
    height: 88,
    alignment: 'center',
  }))
  const featureGlass = featureFrame.add(new Glass({
    cornerRadius: 28,
    pointerEvents: true,
  }))
  featureGlass.add(fillHtml(createElement(
    'layout-glass-card floating',
    `
      <span>Transform</span>
      <strong>ZStack</strong>
    `,
  )))

  // column.add(new Spacer({ minLength: 10 }))

  const footerFrame = column.add(new Frame({
    maxWidth: 'infinity',
    height: 82,
    alignment: 'center',
  }))
  const footerGlass = footerFrame.add(new Glass({
    cornerRadius: 30,
    pointerEvents: true,
  }))
  addFooter(footerGlass)

  return {
    scene,
    column,
    row,
    padding,
    primaryFrame,
    secondaryFrame,
    footerFrame,
    featureTransform,
  }
}

export default function LayoutSceneDemo() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const refs = useRef<LayoutRefs | null>(null)
  const [columnGap, setColumnGap] = useState(INITIAL_COLUMN_GAP)
  const [rowGap, setRowGap] = useState(INITIAL_ROW_GAP)
  const [padding, setPadding] = useState(INITIAL_PADDING)
  const [frameWidth, setFrameWidth] = useState(INITIAL_FRAME_WIDTH)
  const [frameHeight, setFrameHeight] = useState(INITIAL_FRAME_HEIGHT)
  const [transformOffset, setTransformOffset] = useState(INITIAL_TRANSFORM_OFFSET)

  useEffect(() => {
    const current = refs.current
    if (!current) return

    current.column.spacing = columnGap
    current.row.spacing = rowGap
    current.padding.insets = padding
    current.primaryFrame.width = frameWidth
    current.primaryFrame.height = frameHeight
    current.secondaryFrame.height = frameHeight
    current.footerFrame.height = Math.max(70, Math.min(108, frameHeight - 34))
    current.featureTransform.x = transformOffset
    current.featureTransform.y = -Math.round(transformOffset * 0.55)
  }, [columnGap, rowGap, padding, frameWidth, frameHeight, transformOffset])

  useEffect(() => {
    const mount = stageRef.current
    if (!mount) {
      return
    }

    const layoutRefs = buildLayoutScene()
    refs.current = layoutRefs

    const renderer = new Renderer({ scene: layoutRefs.scene.scene })
    renderer.canvas.className = 'demo-canvas'
    mount.append(renderer.canvas)

    let proposal = { width: 0, height: 0 }
    const syncProposal = () => {
      const bounds = mount.getBoundingClientRect()
      proposal = {
        width: bounds.width,
        height: bounds.height,
      }
    }
    const resizeObserver = new ResizeObserver(syncProposal)
    resizeObserver.observe(mount)
    syncProposal()

    let frameId = 0
    const frame = () => {
      layoutRefs.scene.layout(proposal)
      renderer.render()
      frameId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      renderer.destroy()
      layoutRefs.scene.dispose()
      refs.current = null
    }
  }, [])

  return (
    <section className="layout-demo">
      <div ref={stageRef} className="canvas-shell layout-canvas-shell" />

      <aside className="panel layout-controls">
        <Control
          id="layout-column-gap"
          label="VStack gap"
          value={columnGap}
          min={0}
          max={56}
          unit="px"
          onChange={setColumnGap}
        />
        <Control
          id="layout-row-gap"
          label="HStack gap"
          value={rowGap}
          min={0}
          max={72}
          unit="px"
          onChange={setRowGap}
        />
        <Control
          id="layout-padding"
          label="Padding"
          value={padding}
          min={0}
          max={76}
          unit="px"
          onChange={setPadding}
        />
        <Control
          id="layout-frame-width"
          label="Frame width"
          value={frameWidth}
          min={160}
          max={330}
          unit="px"
          onChange={setFrameWidth}
        />
        <Control
          id="layout-frame-height"
          label="Frame height"
          value={frameHeight}
          min={110}
          max={210}
          unit="px"
          onChange={setFrameHeight}
        />
        <Control
          id="layout-transform-offset"
          label="Transform"
          value={transformOffset}
          min={-18}
          max={70}
          unit="px"
          onChange={setTransformOffset}
        />
      </aside>
    </section>
  )
}

type ControlProps = {
  id: string
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (value: number) => void
}

function Control({ id, label, value, min, max, unit, onChange }: ControlProps) {
  return (
    <label className="layout-control" htmlFor={id}>
      <span>{label}</span>
      <output htmlFor={id}>{value}{unit}</output>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}
