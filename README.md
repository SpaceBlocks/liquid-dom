# liquid-glass-dom

`liquid-glass-dom` renders a small scene graph of DOM-backed HTML layers and liquid-glass containers into a WebGPU canvas.

The core API is imperative:

```ts
import { Container, Glass, Html, Renderer, Scene } from 'liquid-glass-dom'

const scene = new Scene()

const backgroundElement = document.createElement('div')
backgroundElement.className = 'background'
const background = new Html({
  width: 800,
  height: 600,
  zIndex: -1,
  element: backgroundElement,
})
scene.add(background)

const container = new Container({
  x: 120,
  y: 120,
  blur: 8,
  spacing: 28,
  thickness: 90,
  zIndex: 0,
})

const glass = new Glass({
  width: 280,
  height: 180,
  cornerRadius: 48,
  pointerEvents: true,
})

const button = document.createElement('button')
button.textContent = 'Native button'
glass.add(new Html({
  x: 24,
  y: 24,
  width: 180,
  height: 56,
  element: button,
}))

container.add(glass)
scene.add(container)

const renderer = new Renderer({ scene })
document.body.append(renderer.canvas)

function frame() {
  renderer.render()
  requestAnimationFrame(frame)
}
frame()
```

## Exports

```ts
import {
  Container,
  Glass,
  GlassPointerEvent,
  Html,
  Renderer,
  Scene,
  type BackdropMetrics,
  type GlassPointerEventType,
  type Point,
  type RgbaColor,
  type SurfaceProfile,
  type Transform,
} from 'liquid-glass-dom'
```

React 19 bindings are available from the `liquid-glass-react` package:

```tsx
import {
  Frame,
  Glass,
  GlassContainer,
  HStack,
  Html,
  LayoutCanvas,
  spring,
  useAnimate,
  useTimeline,
  type GlassRef,
} from 'liquid-glass-react'
```

## React Animation

`LayoutCanvas` owns the renderer, layout scene, and animation clock. Declarative and imperative animations run on the same `requestAnimationFrame` loop used for layout and rendering.

Animations mutate retained layout UI nodes directly. React sets targets; it does not re-render every animation frame.

### Spring Transitions

Add a `transition` prop to animate component prop changes:

```tsx
<GlassContainer>
  <Frame
    width={expanded ? 260 : 140}
    height={120}
    transition={{
      width: spring({ stiffness: 360, damping: 34 }),
    }}
  >
    <Glass>
      <Html sizing="fill">
        <div>Resizable content</div>
      </Html>
    </Glass>
  </Frame>
</GlassContainer>
```

Only properties listed in `transition` animate. Other changed props are assigned immediately. Numeric values and numeric object values, such as `tint`, can animate; strings, booleans, and enums snap to their new value.

You can also pass one transition for every animatable changed prop:

```tsx
<HStack
  spacing={wide ? 32 : 8}
  transition={spring({ stiffness: 300, damping: 30 })}
/>
```

### Glass Hover And Press

`Glass` supports `whileHover` and `whilePress` convenience props. They accept `Glass` props, apply while the glass is hovered or pressed, and return to the normal component props afterward. They do not accept transform props; wrap the glass in `Transform` when you want transform animation.

```tsx
<GlassContainer>
  <Glass
    cornerRadius={32}
    transition={{
      cornerRadius: spring({ stiffness: 520, damping: 42 }),
      zIndex: false,
    }}
    whileHover={{
      cornerRadius: 52,
      zIndex: 10,
    }}
    whilePress={{
      cornerRadius: 20,
    }}
  >
    <Frame width={160} height={96}>
      <Html sizing="fill">
        <button>Press</button>
      </Html>
    </Frame>
  </Glass>
</GlassContainer>
```

`whilePress` takes precedence over `whileHover` when both provide the same prop. These props imply `pointerEvents={true}` unless `pointerEvents={false}` is set explicitly.

As with normal prop changes, hover and press values animate only when the affected property is present in `transition`; otherwise they snap.

### Imperative Animations

Use `useAnimate()` for direct retained-node animations:

```tsx
import { useRef } from 'react'

function PulseButton() {
  const glassRef = useRef<GlassRef | null>(null)
  const animate = useAnimate()

  return (
    <GlassContainer>
      <Glass
        ref={glassRef}
        pointerEvents
        onClick={() => {
          animate(glassRef.current, {
            cornerRadius: 56,
          }, spring({ stiffness: 500, damping: 40 }))
        }}
      />
    </GlassContainer>
  )
}
```

`useAnimate()` returns controls with a `finished` promise and `stop()` method:

```ts
const controls = animate(node, { cornerRadius: 48 }, spring())
await controls.finished
controls.stop()
```

### Timelines

Use `useTimeline()` when animations need to run in sequence:

```tsx
function Sequence({ first, second }: {
  first: React.RefObject<GlassRef | null>
  second: React.RefObject<GlassRef | null>
}) {
  const timeline = useTimeline(spring({ stiffness: 420, damping: 36 }))

  function play() {
    timeline()
      .to(first.current, { cornerRadius: 56 })
      .to(second.current, { cornerRadius: 16 })
      .to(first.current, { cornerRadius: 32 })
      .play()
  }

  return <button onClick={play}>Play</button>
}
```

Timeline steps run one after another. Each `.to(...)` uses the timeline default transition unless a step-specific transition is provided.

## Scene Graph

`Scene` is the root. It accepts `Container` and `Html` children:

```ts
scene.add(new Html({ width: 800, height: 600, zIndex: -1, element }))
scene.add(new Container({ zIndex: 0 }))
```

Scene children are rendered by `zIndex`, then by entry order. A scene-level `Html` layer below a `Container` becomes backdrop content for that container. A scene-level `Html` layer above a `Container` covers it and becomes backdrop content for later containers.

`Container` accepts `Glass` children. A container's glass children are fused into one liquid-glass SDF field and share optical settings.

`Glass` accepts any number of `Html` children. Each child is copied independently and sampled through the owning glass using the child `Html` transform.

## `Html`

`Html` is a DOM-backed leaf node:

```ts
new Html(options?: Partial<Transform> & {
  width?: number
  height?: number
  zIndex?: number
  element?: HTMLElement | null
})
```

Properties:

- `x`, `y`, `scaleX`, `scaleY`, `rotation`, `origin`
- `width`, `height`
- `zIndex`
- `element`
- `host: HTMLDivElement`

Methods:

- `setElement(element: HTMLElement | null): void`
- `remove(): void`

Each `Html` creates and owns its own `host` element. The host is sized from `width` and `height`. `setElement(element)` replaces the host's single child with `element`; `setElement(null)` leaves the host empty. The renderer mounts, transforms, orders, copies, and unmounts the host while the `Html` node is attached to a scene or glass.

The renderer does not assign CSS `pointer-events` properties. Browser interaction is left to normal DOM hit testing for the hosted elements.

## `Glass`

```ts
new Glass(options?: Partial<Transform> & {
  width?: number
  height?: number
  cornerRadius?: number
  cornerTransitionSpeed?: number
  pointerEvents?: boolean
  zIndex?: number
})
```

Properties:

- `x`, `y`, `scaleX`, `scaleY`, `rotation`, `origin`
- `width`, `height`
- `cornerRadius`
- `cornerTransitionSpeed`
- `pointerEvents`
- `zIndex`

Methods:

- `add(child: Html): Html`
- `remove(): void`
- `addEventListener(...)`
- `removeEventListener(...)`

Glass pointer events are renderer-side SDF hit tests. Enable them per glass with `pointerEvents: true`.

Supported event names:

- `click`
- `pointerenter`
- `pointerleave`
- `pointermove`
- `pointerdown`
- `pointerup`
- `pointercancel`

`GlassPointerEvent` exposes:

- `glass`
- `renderer`
- `nativeEvent`
- `pointerId`, `pointerType`, `isPrimary`, `button`, `buttons`
- `clientX`, `clientY`
- `canvasX`, `canvasY`
- `localX`, `localY`
- `inside`

Calling `preventDefault()` on a `GlassPointerEvent` forwards to the native pointer event after dispatch.

Glass pointer hits are based on the individual glass SDF, not fused bridge regions between neighboring glasses. Hosted DOM elements inside a glass can still receive normal browser pointer events, and glass listeners still fire from the renderer's hit-testing path.

Within one container, glass pointer targeting uses higher `glass.zIndex`; ties use later entry order. Across containers, the visually later container layer wins.

## `Container`

```ts
new Container(options?: Partial<Transform> & {
  spacing?: number
  blur?: number
  bezelWidth?: number
  thickness?: number
  displacementFactor?: number
  ior?: number
  contentIor?: number
  contentDepth?: number
  dispersion?: number
  surfaceProfile?: 'convex' | 'concave' | 'lip'
  lightDirection?: number
  specularStrength?: number
  specularWidth?: number | 'hairline'
  specularFalloff?: number
  oppositeSpecularStrength?: number
  specularSharpness?: number
  specularOpacity?: number
  reflectionOffset?: number
  tint?: RgbaColor
  zIndex?: number
})
```

When `oppositeSpecularStrength` is omitted, it defaults to the resolved `specularStrength`.
The default `specularWidth` is `'hairline'`, which resolves to one device pixel at the renderer's current DPR.
Numeric `specularWidth` values are CSS pixels.

Methods:

- `add(child: Glass): Glass`
- `remove(): void`

`contentIor` and `contentDepth` affect refraction of `Html` children rendered inside glass nodes.

## `Renderer`

```ts
new Renderer(options?: {
  scene?: Scene
  maxDpr?: number
})
```

Properties:

- `scene`
- `canvas`
- `maxDpr`

Methods:

- `render(): void`
- `destroy(): void`
- `setBackdropMetricsTracking(container: Container, enabled: boolean): void`
- `getBackdropMetrics(container: Container): BackdropMetrics | null`

`Renderer` creates a `<canvas layoutsubtree="true">`. Append `renderer.canvas` to the page, size it with CSS, and call `renderer.render()` from your own render loop.

## Development

```sh
pnpm --filter liquid-glass-dom build
pnpm --filter minimal build
```
