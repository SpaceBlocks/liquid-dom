# @liquid-dom/react

## Description

`@liquid-dom/react` provides React 19 bindings for the retained liquid-glass layout API. It lets React describe a retained scene while the renderer mutates layout nodes directly between renders.

Use `LayoutCanvas` when the React package should create and own the WebGPU canvas. Use `LayoutSceneRoot` when another renderer, such as a Three adapter, owns the output.

## Install

```sh
pnpm add @liquid-dom/react react react-dom
```

## Quick Start

```tsx
import {
  Frame,
  Glass,
  GlassContainer,
  Html,
  LayoutCanvas,
} from '@liquid-dom/react'

export function App() {
  return (
    <LayoutCanvas style={{ width: '100vw', height: '100vh' }}>
      <GlassContainer blur={12} spacing={28}>
        <Frame width={280} height={160}>
          <Glass cornerRadius={44} pointerEvents>
            <Html sizing="fill">
              <button>Native content</button>
            </Html>
          </Glass>
        </Frame>
      </GlassContainer>
    </LayoutCanvas>
  )
}
```

## API Overview

### Roots

`LayoutCanvas` owns a `LayoutScene`, a `Renderer`, a canvas, and a frame loop.

Common props:

- `className`, `style`: applied to the host element.
- `canvasClassName`, `canvasStyle`: applied to the generated canvas.
- `maxDpr`: caps renderer DPR.
- `proposal`: fixed layout proposal. If omitted, the host element is measured with `ResizeObserver`.
- `frameloop`: `'always'` or `'demand'`.
- `onError`: frame-loop error handler.

`LayoutSceneRoot` is headless. It builds a retained `LayoutScene` without creating a renderer or canvas. Use its ref from another renderer and call `update(proposal, delta)` before rendering.

### Layout Components

```tsx
import {
  Background,
  Frame,
  HStack,
  Overlay,
  Padding,
  Spacer,
  Transform,
  VStack,
  ZStack,
} from '@liquid-dom/react'
```

These components mirror the retained layout classes from `@liquid-dom/core/layout`.

- `HStack`, `VStack`, and `ZStack` arrange children.
- `Frame`, `Padding`, and `Spacer` constrain or expand layout.
- `Background` and `Overlay` add decoration slots that do not affect content size.
- `Transform` applies scene transforms after layout.

All layout components expose refs to their retained nodes and accept a `transition` prop for animatable property changes.

Some layout components accept exactly one direct child: `Frame`, `Padding`, `Transform`, `GlassContainer`, and `Glass`. If you need multiple children inside one of these components, wrap them in a multi-child layout component such as `HStack`, `VStack`, or `ZStack`, then pass that wrapper as the single child.

### Glass Components

```tsx
import { Glass, GlassContainer, Html } from '@liquid-dom/react'
```

- `GlassContainer` owns the optical settings shared by its glass children, including blur, spacing, tint, refraction, specular, and shadow options.
- `Glass` defines one rounded-rectangle glass shape and can opt into SDF pointer events.
- `Html` renders React children into a DOM element owned by the retained `Html` node.

`Html` supports `sizing="intrinsic"`, `sizing="constrained-width"`, and `sizing="fill"`.

### Node Relationship Rules

React components ultimately synchronize into the `@liquid-dom/core` scene graph, so nested children must satisfy the underlying parent rules:

- `GlassContainer` is the parent for `Glass` shapes.
- `Glass` is the parent for `Html` content.
- `Glass` cannot be nested under another `Glass`.
- Layout components do not make an invalid scene relationship valid.

For example, a `Glass` nested under `Frame` or `Transform` inside another `Glass` is still invalid, because all nested children are checked against the nearest glass scene parent.

### Hover And Press

`Glass` supports `whileHover` and `whilePress` convenience props. They accept `Glass` props, apply while hovered or pressed, and return to the normal component props afterward.

```tsx
<Glass
  cornerRadius={32}
  transition={{ cornerRadius: spring({ stiffness: 520, damping: 42 }) }}
  whileHover={{ cornerRadius: 52 }}
  whilePress={{ cornerRadius: 20 }}
/>
```

`whilePress` takes precedence over `whileHover` when both provide the same prop. These props imply `pointerEvents={true}` unless `pointerEvents={false}` is set explicitly.

`onHover` and `onPress` receive the same interaction state as booleans. They are useful when the interaction should drive a parent or sibling component:

```tsx
const [pressed, setPressed] = useState(false)

<Transform
  scaleX={pressed ? 0.96 : 1}
  scaleY={pressed ? 0.96 : 1}
  transition={{ scaleX: spring(), scaleY: spring() }}
>
  <Glass onPress={setPressed} />
</Transform>
```

### Animation

```tsx
import {
  spring,
  useAnimate,
  useFrame,
  useInvalidateFrame,
  useInvalidateLayout,
  useLayoutScene,
  useRenderer,
  useTimeline,
} from '@liquid-dom/react'
```

Declarative prop animation uses `transition`:

```tsx
<Frame
  width={expanded ? 260 : 140}
  height={120}
  transition={{
    width: spring({ stiffness: 360, damping: 34 }),
  }}
/>
```

Only properties listed in `transition` animate. Numeric values and numeric object values can animate; strings, booleans, and enums snap.

`useAnimate()` starts direct retained-node animations and returns controls with `finished` and `stop()`. `useTimeline()` creates sequential animation timelines. `useFrame()` registers a callback in the nearest `LayoutCanvas` frame loop.

## Integration Notes

- React 19 is required.
- Rendering requires WebGPU through `@liquid-dom/core`.
- DOM-backed `Html` content requires the experimental HTML-in-Canvas API, currently available only behind Chrome's Canvas Draw Element flag: `chrome://flags/#canvas-draw-element`.
- `LayoutCanvas` is the only root that exposes `useRenderer()`. Calling `useRenderer()` under `LayoutSceneRoot` throws.
- `LayoutSceneRoot` exposes `onInvalidateFrame` and `onInvalidateLayout` so external renderers can support demand-driven rendering.
- React children inside `Html` are portaled into retained DOM hosts.
- The retained scene mutates outside React render. Use refs and hooks for imperative animation and renderer interop.
- Reference: [WICG HTML-in-Canvas](https://wicg.github.io/html-in-canvas/).

## Local Development

```sh
pnpm --filter @liquid-dom/react build
pnpm --filter @liquid-dom/react test
pnpm --filter @liquid-dom/react watch
```
