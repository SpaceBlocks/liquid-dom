import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import type { GlassPointerEvent } from './events'
import {
  Background as LayoutBackground,
  Frame as LayoutFrame,
  Glass as LayoutGlass,
  GlassContainer as LayoutGlassContainer,
  HStack as LayoutHStack,
  Html as LayoutHtml,
  LayoutScene,
  Overlay as LayoutOverlay,
  Padding as LayoutPadding,
  Spacer as LayoutSpacer,
  Transform as LayoutTransform,
  VStack as LayoutVStack,
  ZStack as LayoutZStack,
  type GlassContainerOptions,
  type GlassOptions,
  type HtmlOptions,
  type LayoutUiNode,
  type TransformOptions,
} from './layout'
import { Renderer } from './renderer'
import type {
  DecorationOptions,
  FrameOptions,
  PaddingOptions,
  ProposedSize,
  SpacerOptions,
  StackOptions,
  ZStackOptions,
} from 'laymeout'

type LayoutParent = LayoutScene | LayoutUiNode
type FrameLoopEntry = {
  callbackRef: MutableRefObject<FrameCallback>
  priority: number
  order: number
}
type RegisteredChild = {
  node: LayoutUiNode
  order: number
  sequence: number
}
type ChildRegistrar = {
  registerChild: (node: LayoutUiNode, order: number) => () => void
}
type RootContextValue = {
  layoutScene: LayoutScene
  getRenderer: () => Renderer | null
  invalidateLayout: () => void
  invalidateFrame: () => void
  registerFrame: (callbackRef: MutableRefObject<FrameCallback>, priority: number) => () => void
}
type FrameState = {
  layoutScene: LayoutScene
  renderer: Renderer
  scene: LayoutScene['scene']
  canvas: HTMLCanvasElement
  time: number
  delta: number
  invalidateLayout: () => void
  invalidateFrame: () => void
}

/** Callback registered into a {@link LayoutCanvas} frame loop. */
export type FrameCallback = (state: FrameState) => void
/** Render-loop mode used by {@link LayoutCanvas}. */
export type FrameLoopMode = 'always' | 'demand'
/** Imperative handle exposed by {@link LayoutCanvas}. */
export type LayoutCanvasRef = {
  readonly layoutScene: LayoutScene
  readonly scene: LayoutScene['scene']
  readonly renderer: Renderer
  readonly canvas: HTMLCanvasElement
  invalidateLayout: () => void
  invalidateFrame: () => void
}
export type HStackRef = LayoutHStack
export type VStackRef = LayoutVStack
export type FrameRef = LayoutFrame
export type PaddingRef = LayoutPadding
export type OverlayRef = LayoutOverlay
export type BackgroundRef = LayoutBackground
export type ZStackRef = LayoutZStack
export type TransformRef = LayoutTransform
export type GlassContainerRef = LayoutGlassContainer
export type GlassRef = LayoutGlass
export type HtmlRef = LayoutHtml
export type SpacerRef = LayoutSpacer

type RefProp<T> = {
  ref?: Ref<T>
}
type ChildrenProp = {
  children?: ReactNode
}
export type LayoutCanvasProps = ChildrenProp & RefProp<LayoutCanvasRef> & {
  className?: string
  style?: CSSProperties
  canvasClassName?: string
  canvasStyle?: CSSProperties
  maxDpr?: number
  proposal?: ProposedSize
  frameloop?: FrameLoopMode
  onError?: (error: unknown) => void
}
export type HStackProps = ChildrenProp & RefProp<HStackRef> & StackOptions
export type VStackProps = ChildrenProp & RefProp<VStackRef> & StackOptions
export type ZStackProps = ChildrenProp & RefProp<ZStackRef> & ZStackOptions
export type FrameProps = ChildrenProp & RefProp<FrameRef> & FrameOptions
export type PaddingProps = ChildrenProp & RefProp<PaddingRef> & PaddingOptions
export type OverlayProps = ChildrenProp & RefProp<OverlayRef> & DecorationOptions & {
  overlay?: ReactNode
}
export type BackgroundProps = ChildrenProp & RefProp<BackgroundRef> & DecorationOptions & {
  background?: ReactNode
}
export type TransformProps = ChildrenProp & RefProp<TransformRef> & TransformOptions
export type GlassContainerProps = ChildrenProp & RefProp<GlassContainerRef> & GlassContainerOptions
export type GlassPointerHandler = (event: GlassPointerEvent) => void
export type GlassProps = ChildrenProp & RefProp<GlassRef> & GlassOptions & {
  onClick?: GlassPointerHandler
  onPointerEnter?: GlassPointerHandler
  onPointerLeave?: GlassPointerHandler
  onPointerMove?: GlassPointerHandler
  onPointerDown?: GlassPointerHandler
  onPointerUp?: GlassPointerHandler
  onPointerCancel?: GlassPointerHandler
}
export type HtmlProps = ChildrenProp & RefProp<HtmlRef> & Omit<HtmlOptions, 'element'>
export type SpacerProps = RefProp<SpacerRef> & SpacerOptions

const RootContext = createContext<RootContextValue | null>(null)
const ParentContext = createContext<ChildRegistrar | null>(null)
const ChildOrderContext = createContext(0)

function createRequiredRendererGetter(rendererRef: MutableRefObject<Renderer | null>) {
  return () => {
    const renderer = rendererRef.current
    if (!renderer) {
      throw new Error('LayoutCanvas renderer is not available until the component is mounted.')
    }
    return renderer
  }
}

function sameChildren(left: readonly LayoutUiNode[], right: readonly LayoutUiNode[]) {
  return left.length === right.length && left.every((node, index) => node === right[index])
}

function currentChildren(parent: LayoutParent): LayoutUiNode[] {
  if (parent instanceof LayoutScene) {
    return parent.root ? [parent.root] : []
  }

  return [...parent.children]
}

function acceptsSingleChild(parent: LayoutParent) {
  return (
    parent instanceof LayoutScene ||
    parent instanceof LayoutFrame ||
    parent instanceof LayoutPadding ||
    parent instanceof LayoutTransform ||
    parent instanceof LayoutGlassContainer ||
    parent instanceof LayoutGlass
  )
}

function syncOrderedChildren(parent: LayoutParent, nextChildren: readonly LayoutUiNode[]) {
  if (acceptsSingleChild(parent) && nextChildren.length > 1) {
    throw new Error(`${parent.constructor.name} accepts exactly one child.`)
  }

  const previousChildren = currentChildren(parent)
  if (sameChildren(previousChildren, nextChildren)) {
    return
  }

  for (const child of previousChildren) {
    if (!nextChildren.includes(child)) {
      child.remove()
    }
  }

  for (const child of previousChildren) {
    if (nextChildren.includes(child)) {
      child.remove()
    }
  }

  for (const child of nextChildren) {
    parent.add(child)
  }
}

function useOrderedChildRegistrar(
  syncChildren: (children: readonly LayoutUiNode[]) => void,
): ChildRegistrar {
  const entriesRef = useRef<RegisteredChild[]>([])
  const sequenceRef = useRef(0)
  const syncChildrenRef = useRef(syncChildren)
  syncChildrenRef.current = syncChildren

  return useMemo(() => {
    const sync = () => {
      const children = [...entriesRef.current]
        .sort((left, right) => left.order - right.order || left.sequence - right.sequence)
        .map((entry) => entry.node)
      syncChildrenRef.current(children)
    }

    return {
      registerChild(node, order) {
        const entry = {
          node,
          order,
          sequence: sequenceRef.current,
        }
        sequenceRef.current += 1
        entriesRef.current.push(entry)
        sync()

        return () => {
          entriesRef.current = entriesRef.current.filter((candidate) => candidate !== entry)
          node.remove()
          sync()
        }
      },
    }
  }, [])
}

function OrderedChildren({ children }: ChildrenProp) {
  return Children.map(children, (child, index) => (
    <ChildOrderContext.Provider value={index}>
      {child}
    </ChildOrderContext.Provider>
  ))
}

function useRequiredRoot() {
  const root = useContext(RootContext)
  if (!root) {
    throw new Error('liquid-glass-dom/react components must be rendered inside LayoutCanvas.')
  }
  return root
}

function useRequiredParent() {
  const parent = useContext(ParentContext)
  if (!parent) {
    throw new Error('Layout node components must be rendered inside a layout parent.')
  }
  return parent
}

function useStableNode<T>(factory: () => T) {
  const ref = useRef<T | null>(null)
  if (!ref.current) {
    ref.current = factory()
  }
  return ref.current
}

function useExposeRef<T>(ref: Ref<T> | undefined, value: T) {
  useImperativeHandle(ref, () => value, [value])
}

function useAttachNode(node: LayoutUiNode) {
  const parent = useRequiredParent()
  const order = useContext(ChildOrderContext)

  useLayoutEffect(() => parent.registerChild(node, order), [node, order, parent])
}

function useRetainedLayoutEffect(effect: () => void, deps: readonly unknown[]) {
  useLayoutEffect(() => {
    effect()
  }, deps)
}

function useNodeParent(node: LayoutUiNode) {
  return useOrderedChildRegistrar(
    useCallback((children) => syncOrderedChildren(node, children), [node]),
  )
}

function renderNodeChildren(parent: ChildRegistrar, children: ReactNode) {
  return (
    <ParentContext.Provider value={parent}>
      <OrderedChildren>{children}</OrderedChildren>
    </ParentContext.Provider>
  )
}

function syncDecorationSlot(
  node: LayoutOverlay | LayoutBackground,
  slot: 'content' | 'decoration',
  currentRef: MutableRefObject<LayoutUiNode | null>,
  children: readonly LayoutUiNode[],
) {
  if (children.length > 1) {
    throw new Error(`${node.constructor.name} ${slot} slot accepts exactly one child.`)
  }

  const next = children[0] ?? null
  if (currentRef.current === next) {
    return
  }

  currentRef.current?.remove()
  currentRef.current = next
  if (!next) {
    return
  }

  if (slot === 'content') {
    node.setContent(next)
  } else {
    node.setDecoration(next)
  }
}

function useDecorationSlotRegistrar(node: LayoutOverlay | LayoutBackground, slot: 'content' | 'decoration') {
  const currentRef = useRef<LayoutUiNode | null>(null)
  return useOrderedChildRegistrar(
    useCallback((children) => syncDecorationSlot(node, slot, currentRef, children), [node, slot]),
  )
}

function useStyleObject(style: CSSProperties | undefined) {
  const styleRef = useRef(style)
  styleRef.current = style
  return styleRef
}

function applyStyle(element: HTMLElement, style: CSSProperties | undefined) {
  if (!style) {
    return
  }

  Object.assign(element.style, style)
}

/** Root component that owns a layout scene, renderer, canvas, and frame loop. */
export function LayoutCanvas({
  ref,
  children,
  className,
  style,
  canvasClassName,
  canvasStyle,
  maxDpr = 2,
  proposal,
  frameloop = 'always',
  onError,
}: LayoutCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const layoutScene = useStableNode(() => new LayoutScene())
  const [ready, setReady] = useState(false)
  const proposalRef = useRef<ProposedSize>({ width: 0, height: 0 })
  const layoutDirtyRef = useRef(true)
  const frameDirtyRef = useRef(true)
  const frameLoopEntriesRef = useRef(new Set<FrameLoopEntry>())
  const frameEntryOrderRef = useRef(0)
  const frameLoopModeRef = useRef(frameloop)
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)
  const onErrorRef = useRef(onError)
  const canvasStyleRef = useStyleObject(canvasStyle)
  onErrorRef.current = onError
  frameLoopModeRef.current = frameloop

  const getRenderer = useCallback(() => rendererRef.current, [])
  const requireRenderer = useMemo(() => createRequiredRendererGetter(rendererRef), [])

  const runFrameRef = useRef<(time: number) => void>(() => undefined)
  const scheduleFrame = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return
    }

    animationFrameRef.current = requestAnimationFrame((time) => runFrameRef.current(time))
  }, [])

  const invalidateFrame = useCallback(() => {
    frameDirtyRef.current = true
    scheduleFrame()
  }, [scheduleFrame])

  const invalidateLayout = useCallback(() => {
    layoutDirtyRef.current = true
    frameDirtyRef.current = true
    scheduleFrame()
  }, [scheduleFrame])

  const registerFrame = useCallback((callbackRef: MutableRefObject<FrameCallback>, priority: number) => {
    const entry = {
      callbackRef,
      priority,
      order: frameEntryOrderRef.current,
    }
    frameEntryOrderRef.current += 1
    frameLoopEntriesRef.current.add(entry)
    invalidateFrame()

    return () => {
      frameLoopEntriesRef.current.delete(entry)
    }
  }, [invalidateFrame])

  runFrameRef.current = (time) => {
    animationFrameRef.current = null
    const renderer = rendererRef.current
    if (!renderer) {
      return
    }

    const previousTime = lastFrameTimeRef.current ?? time
    lastFrameTimeRef.current = time
    const frameState: FrameState = {
      layoutScene,
      renderer,
      scene: layoutScene.scene,
      canvas: renderer.canvas,
      time,
      delta: time - previousTime,
      invalidateLayout,
      invalidateFrame,
    }

    const entries = [...frameLoopEntriesRef.current]
      .sort((left, right) => left.priority - right.priority || left.order - right.order)
    try {
      for (const entry of entries) {
        entry.callbackRef.current(frameState)
      }

      const shouldLayout = layoutDirtyRef.current
      if (shouldLayout) {
        layoutScene.layout(proposalRef.current)
        layoutDirtyRef.current = false
      }

      if (frameLoopModeRef.current === 'always' || frameDirtyRef.current || shouldLayout) {
        renderer.render()
        frameDirtyRef.current = false
      }
    } catch (error) {
      onErrorRef.current?.(error)
      if (!onErrorRef.current) {
        throw error
      }
    }

    if (frameLoopModeRef.current === 'always' || frameDirtyRef.current || layoutDirtyRef.current) {
      scheduleFrame()
    }
  }

  const rootParent = useOrderedChildRegistrar(
    useCallback((children) => syncOrderedChildren(layoutScene, children), [layoutScene]),
  )
  const rootContextValue = useMemo(() => ({
    layoutScene,
    getRenderer,
    invalidateLayout,
    invalidateFrame,
    registerFrame,
  }), [layoutScene, getRenderer, invalidateLayout, invalidateFrame, registerFrame])

  useImperativeHandle(ref, () => ({
    layoutScene,
    scene: layoutScene.scene,
    get renderer() {
      return requireRenderer()
    },
    get canvas() {
      return requireRenderer().canvas
    },
    invalidateLayout,
    invalidateFrame,
  }), [layoutScene, requireRenderer, invalidateLayout, invalidateFrame])

  useLayoutEffect(() => layoutScene.addInvalidationListener((invalidation) => {
    if (invalidation.kind === 'layout') {
      invalidateLayout()
    } else {
      invalidateFrame()
    }
  }), [layoutScene, invalidateLayout, invalidateFrame])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }

    const renderer = new Renderer({ scene: layoutScene.scene, maxDpr })
    rendererRef.current = renderer
    renderer.canvas.className = canvasClassName ?? ''
    applyStyle(renderer.canvas, canvasStyleRef.current)
    host.append(renderer.canvas)
    setReady(true)
    invalidateLayout()

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      renderer.destroy()
      renderer.canvas.remove()
      rendererRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) {
      return
    }

    renderer.maxDpr = maxDpr
    renderer.canvas.className = canvasClassName ?? ''
    applyStyle(renderer.canvas, canvasStyle)
    invalidateFrame()
  }, [maxDpr, canvasClassName, canvasStyle, invalidateFrame])

  useLayoutEffect(() => {
    if (proposal) {
      proposalRef.current = proposal
      invalidateLayout()
      return
    }

    const host = hostRef.current
    if (!host) {
      return
    }

    const syncProposal = () => {
      const bounds = host.getBoundingClientRect()
      proposalRef.current = {
        width: bounds.width,
        height: bounds.height,
      }
      invalidateLayout()
    }

    syncProposal()
    const observer = new ResizeObserver(syncProposal)
    observer.observe(host)
    return () => observer.disconnect()
  }, [proposal?.width, proposal?.height, invalidateLayout])

  useEffect(() => {
    if (frameloop === 'always') {
      scheduleFrame()
    }
  }, [frameloop, ready, scheduleFrame])

  return (
    <div ref={hostRef} className={className} style={style}>
      {ready ? (
        <RootContext.Provider value={rootContextValue}>
          {renderNodeChildren(rootParent, children)}
        </RootContext.Provider>
      ) : null}
    </div>
  )
}

/** Registers a callback in the nearest {@link LayoutCanvas} frame loop. */
export function useFrame(callback: FrameCallback, priority = 0) {
  const root = useRequiredRoot()
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => root.registerFrame(callbackRef, priority), [root, priority])
}

/** Returns the nearest retained layout scene. */
export function useLayoutScene() {
  return useRequiredRoot().layoutScene
}

/** Returns the nearest renderer. */
export function useRenderer() {
  const renderer = useRequiredRoot().getRenderer()
  if (!renderer) {
    throw new Error('Renderer is not available until LayoutCanvas is mounted.')
  }
  return renderer
}

/** Returns a function that schedules a layout pass and frame. */
export function useInvalidateLayout() {
  return useRequiredRoot().invalidateLayout
}

/** Returns a function that schedules a frame without marking layout dirty. */
export function useInvalidateFrame() {
  return useRequiredRoot().invalidateFrame
}

/** Horizontal stack layout component. */
export function HStack({ ref, children, spacing = 0, alignment = 'center' }: HStackProps) {
  const node = useStableNode(() => new LayoutHStack({ spacing, alignment }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.spacing = spacing
    node.alignment = alignment
  }, [node, spacing, alignment])

  return renderNodeChildren(useNodeParent(node), children)
}

/** Vertical stack layout component. */
export function VStack({ ref, children, spacing = 0, alignment = 'center' }: VStackProps) {
  const node = useStableNode(() => new LayoutVStack({ spacing, alignment }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.spacing = spacing
    node.alignment = alignment
  }, [node, spacing, alignment])

  return renderNodeChildren(useNodeParent(node), children)
}

/** Z-stack layout component. */
export function ZStack({ ref, children, alignment = 'center' }: ZStackProps) {
  const node = useStableNode(() => new LayoutZStack({ alignment }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.alignment = alignment
  }, [node, alignment])

  return renderNodeChildren(useNodeParent(node), children)
}

/** Fixed, constrained, or aligned frame layout component. */
export function Frame({
  ref,
  children,
  width,
  height,
  minWidth,
  minHeight,
  idealWidth,
  idealHeight,
  maxWidth,
  maxHeight,
  alignment = 'center',
}: FrameProps) {
  const node = useStableNode(() => new LayoutFrame({
    width,
    height,
    minWidth,
    minHeight,
    idealWidth,
    idealHeight,
    maxWidth,
    maxHeight,
    alignment,
  }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.width = width
    node.height = height
    node.minWidth = minWidth
    node.minHeight = minHeight
    node.idealWidth = idealWidth
    node.idealHeight = idealHeight
    node.maxWidth = maxWidth
    node.maxHeight = maxHeight
    node.alignment = alignment
  }, [node, width, height, minWidth, minHeight, idealWidth, idealHeight, maxWidth, maxHeight, alignment])

  return renderNodeChildren(useNodeParent(node), children)
}

/** Padding layout component. */
export function Padding({ ref, children, insets = 0 }: PaddingProps) {
  const node = useStableNode(() => new LayoutPadding({ insets }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.insets = insets
  }, [node, insets])

  return renderNodeChildren(useNodeParent(node), children)
}

/** Overlay layout component with a dedicated overlay slot prop. */
export function Overlay({ ref, children, overlay, alignment = 'center' }: OverlayProps) {
  const node = useStableNode(() => new LayoutOverlay({ alignment }))
  const contentParent = useDecorationSlotRegistrar(node, 'content')
  const overlayParent = useDecorationSlotRegistrar(node, 'decoration')
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.alignment = alignment
  }, [node, alignment])

  return (
    <>
      {renderNodeChildren(contentParent, children)}
      {renderNodeChildren(overlayParent, overlay)}
    </>
  )
}

/** Background layout component with a dedicated background slot prop. */
export function Background({ ref, children, background, alignment = 'center' }: BackgroundProps) {
  const node = useStableNode(() => new LayoutBackground({ alignment }))
  const contentParent = useDecorationSlotRegistrar(node, 'content')
  const backgroundParent = useDecorationSlotRegistrar(node, 'decoration')
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.alignment = alignment
  }, [node, alignment])

  return (
    <>
      {renderNodeChildren(contentParent, children)}
      {renderNodeChildren(backgroundParent, background)}
    </>
  )
}

/** Transform-only layout component. */
export function Transform({
  ref,
  children,
  x = 0,
  y = 0,
  scaleX = 1,
  scaleY = 1,
  rotation = 0,
  origin,
}: TransformProps) {
  const node = useStableNode(() => new LayoutTransform({ x, y, scaleX, scaleY, rotation, origin }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    node.x = x
    node.y = y
    node.scaleX = scaleX
    node.scaleY = scaleY
    node.rotation = rotation
    node.origin = origin ?? { x: 0, y: 0 }
  }, [node, x, y, scaleX, scaleY, rotation, origin])

  return renderNodeChildren(useNodeParent(node), children)
}

/** Liquid-glass container component. */
export function GlassContainer({
  ref,
  children,
  spacing,
  blur,
  bezelWidth,
  thickness,
  displacementFactor,
  ior,
  contentIor,
  contentDepth,
  dispersion,
  surfaceProfile,
  lightDirection,
  specularStrength,
  specularWidth,
  specularFalloff,
  oppositeSpecularStrength,
  specularSharpness,
  specularOpacity,
  reflectionOffset,
  tint,
  zIndex,
}: GlassContainerProps) {
  const node = useStableNode(() => new LayoutGlassContainer({
    spacing,
    blur,
    bezelWidth,
    thickness,
    displacementFactor,
    ior,
    contentIor,
    contentDepth,
    dispersion,
    surfaceProfile,
    lightDirection,
    specularStrength,
    specularWidth,
    specularFalloff,
    oppositeSpecularStrength,
    specularSharpness,
    specularOpacity,
    reflectionOffset,
    tint,
    zIndex,
  }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    if (spacing !== undefined) node.spacing = spacing
    if (blur !== undefined) node.blur = blur
    if (bezelWidth !== undefined) node.bezelWidth = bezelWidth
    if (thickness !== undefined) node.thickness = thickness
    if (displacementFactor !== undefined) node.displacementFactor = displacementFactor
    if (ior !== undefined) node.ior = ior
    if (contentIor !== undefined) node.contentIor = contentIor
    if (contentDepth !== undefined) node.contentDepth = contentDepth
    if (dispersion !== undefined) node.dispersion = dispersion
    if (surfaceProfile !== undefined) node.surfaceProfile = surfaceProfile
    if (lightDirection !== undefined) node.lightDirection = lightDirection
    if (specularStrength !== undefined) node.specularStrength = specularStrength
    if (specularWidth !== undefined) node.specularWidth = specularWidth
    if (specularFalloff !== undefined) node.specularFalloff = specularFalloff
    if (oppositeSpecularStrength !== undefined) node.oppositeSpecularStrength = oppositeSpecularStrength
    if (specularSharpness !== undefined) node.specularSharpness = specularSharpness
    if (specularOpacity !== undefined) node.specularOpacity = specularOpacity
    if (reflectionOffset !== undefined) node.reflectionOffset = reflectionOffset
    if (tint !== undefined) node.tint = tint
    if (zIndex !== undefined) node.zIndex = zIndex
  }, [
    node,
    spacing,
    blur,
    bezelWidth,
    thickness,
    displacementFactor,
    ior,
    contentIor,
    contentDepth,
    dispersion,
    surfaceProfile,
    lightDirection,
    specularStrength,
    specularWidth,
    specularFalloff,
    oppositeSpecularStrength,
    specularSharpness,
    specularOpacity,
    reflectionOffset,
    tint,
    zIndex,
  ])

  return renderNodeChildren(useNodeParent(node), children)
}

/** Liquid-glass shape component. */
export function Glass({
  ref,
  children,
  cornerRadius,
  cornerTransitionSpeed,
  pointerEvents,
  zIndex,
  onClick,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
}: GlassProps) {
  const hasPointerHandler = Boolean(
    onClick ||
    onPointerEnter ||
    onPointerLeave ||
    onPointerMove ||
    onPointerDown ||
    onPointerUp ||
    onPointerCancel,
  )
  const effectivePointerEvents = pointerEvents ?? hasPointerHandler
  const node = useStableNode(() => new LayoutGlass({
    cornerRadius,
    cornerTransitionSpeed,
    pointerEvents: effectivePointerEvents,
    zIndex,
  }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    if (cornerRadius !== undefined) node.cornerRadius = cornerRadius
    if (cornerTransitionSpeed !== undefined) node.cornerTransitionSpeed = cornerTransitionSpeed
    node.pointerEvents = effectivePointerEvents
    if (zIndex !== undefined) node.zIndex = zIndex
  }, [node, cornerRadius, cornerTransitionSpeed, effectivePointerEvents, zIndex])

  useEffect(() => {
    const listeners: Array<[string, GlassPointerHandler | undefined]> = [
      ['click', onClick],
      ['pointerenter', onPointerEnter],
      ['pointerleave', onPointerLeave],
      ['pointermove', onPointerMove],
      ['pointerdown', onPointerDown],
      ['pointerup', onPointerUp],
      ['pointercancel', onPointerCancel],
    ]

    for (const [type, listener] of listeners) {
      if (listener) {
        node.sceneNode.addEventListener(type, listener as EventListener)
      }
    }

    return () => {
      for (const [type, listener] of listeners) {
        if (listener) {
          node.sceneNode.removeEventListener(type, listener as EventListener)
        }
      }
    }
  }, [node, onClick, onPointerEnter, onPointerLeave, onPointerMove, onPointerDown, onPointerUp, onPointerCancel])

  return renderNodeChildren(useNodeParent(node), children)
}

/** DOM-backed HTML layout component. */
export function Html({
  ref,
  children,
  zIndex,
  sizing,
}: HtmlProps) {
  const node = useStableNode(() => new LayoutHtml({
    zIndex,
    sizing,
  }))
  useExposeRef(ref, node)
  useAttachNode(node)

  useRetainedLayoutEffect(() => {
    node.sizing = sizing
    if (zIndex !== undefined) {
      node.zIndex = zIndex
    }
  }, [
    node,
    zIndex,
    sizing,
  ])

  return node.element ? createPortal(children, node.element) : null
}

/** Layout-only spacer component. */
export function Spacer({ ref, minLength }: SpacerProps) {
  const node = useStableNode(() => new LayoutSpacer({ minLength }))
  useExposeRef(ref, node)
  useAttachNode(node)
  useRetainedLayoutEffect(() => {
    if (minLength !== undefined) node.minLength = minLength
  }, [node, minLength])

  return null
}
