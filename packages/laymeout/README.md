# laymeout

## Description

`laymeout` is a renderer-agnostic TypeScript layout engine inspired by SwiftUI's two-step layout model: parents propose a size, children report a size, then parents place children into rectangles.

It does not render UI. It gives you retained layout nodes with stable ids, mutable layout properties, measurement caching, and calculated geometry written directly to each node. Your DOM, Canvas, SVG, WebGL, native, or custom renderer owns the visual objects and reads `node.layout`.

## Install

```sh
pnpm add laymeout
```

## Quick Start

```ts
import { createLayoutEngine, frame, hstack, leaf, spacer } from 'laymeout'

const label = leaf({
  measure: () => ({ width: 82, height: 28 }),
})

const button = leaf({
  measure: () => ({ width: 68, height: 34 }),
})

const row = hstack({ spacing: 12, alignment: 'center' }, label, spacer(), button)
const root = frame(row, { width: 320, height: 56 })

const engine = createLayoutEngine({ root })
const stats = engine.layout({ width: 320, height: 56 })

console.log(stats.measureCalls)
console.log(label.layout?.rect)

row.spacing = 20
engine.layout({ width: 320, height: 56 })
```

## API Overview

### Layout Engine

```ts
import { createLayoutEngine } from 'laymeout'

const engine = createLayoutEngine({
  root,
  onInvalidate: () => requestAnimationFrame(render),
  maxCachedMeasurements: 50_000,
})

engine.root = root
const stats = engine.layout({ width: 800 })
engine.dispose()
```

`layout(proposal)` throws until `root` is assigned. It mutates reachable nodes by writing `node.layout`, then returns debug stats. Set `maxCachedMeasurements: 0` to disable measurement caching while profiling.

### Retained Nodes

Nodes are retained mutable objects. Builders such as `hstack`, `vstack`, `frame`, `padding`, and `leaf` return node instances with stable generated ids and property setters.

```ts
const row = hstack({ spacing: 8 })
row.append(title, spacer(), button)

row.spacing = 16
engine.layout({ width: 800 })
```

A node has one parent. Appending it to another parent automatically detaches it from the old parent, matching DOM parenting.

Every node exposes:

- `id`, `kind`, `parent`, `children`, and `layout`
- `append`, `prepend`, `insertBefore`, `replaceChildren`, `remove`, and `dispose`

`layout.rect` is relative to the parent layout node. Detached nodes keep their last layout until they are laid out again.

### Leaves

`leaf(spec)` creates a renderer-owned leaf. Leaves define their own measurement behavior.

```ts
const title = leaf({
  measure: (proposal) => ({
    width: proposal.width ?? 180,
    height: 32,
  }),
  subscribe: (notify) => {
    const unsubscribe = model.onChange(() => notify('model'))
    return unsubscribe
  },
  measureKey: model.version,
})

title.invalidateMeasure('manual')
```

Use `measureKey`, replace `measure`, or call `invalidateMeasure()` when measurement behavior changes outside a subscription.

### Built-In Layouts

```ts
import {
  background,
  defineLayout,
  frame,
  hstack,
  leaf,
  noop,
  overlay,
  padding,
  spacer,
  vstack,
  zstack,
} from 'laymeout'
```

- `hstack` and `vstack` place children along one axis with fixed spacing and cross-axis alignment.
- `zstack` sizes to the maximum child width and height, then aligns each child inside that shared bounds.
- `frame` proposes constraints to its child, clamps the reported size, and aligns the child inside the frame.
- `padding` subtracts insets before measuring the child and adds them back to its own size.
- `spacer` expands in finite proposals.
- `noop` forwards the same proposal to its single child.
- `background` and `overlay` place decorations in the content bounds without affecting parent layout.
- `defineLayout` creates custom containers with explicit `measure` and `place` functions.

### Custom Layouts

```ts
const flow = defineLayout({
  kind: 'flow',
  measure: ({ children, proposal }) => {
    const sizes = children.map((child) => child.measure(proposal))
    return {
      width: sizes.reduce((sum, size) => sum + size.width, 0),
      height: Math.max(0, ...sizes.map((size) => size.height)),
    }
  },
  place: ({ bounds, children, proposal }) => {
    let x = bounds.x
    for (const child of children) {
      const size = child.measure(proposal)
      child.place({ x, y: bounds.y, width: size.width, height: size.height }, size)
      x += size.width
    }
  },
})
```

`place` is command-style: call `child.place(...)` directly. `bounds` is in the layout node's own local coordinate space, so direct child placements are parent-local rects.

### DOM Helpers

The `laymeout/dom` subpath provides `domLeaf`, `measureDomElement`, and `subscribeDomElement` for HTML element measurement.

```ts
import { domLeaf } from 'laymeout/dom'

const node = domLeaf({
  element,
  sizing: 'intrinsic',
})
```

`sizing` can be `intrinsic`, `constrained-width`, or `fill`.

## Integration Notes

Keep render metadata outside layout nodes. A UI object can hold a reference to its layout node:

```ts
type View = {
  element: HTMLElement
  layoutNode: import('laymeout').LayoutNode
}

function applyViewLayout(view: View) {
  const layout = view.layoutNode.layout
  if (!layout) return

  Object.assign(view.element.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    transform: `translate3d(${layout.rect.x}px, ${layout.rect.y}px, 0)`,
    width: `${layout.rect.width}px`,
    height: `${layout.rect.height}px`,
  })
}
```

If your renderer skips layout-only intermediary nodes, accumulate ancestor offsets in userland or attach render groups to the intermediary layout nodes that own those coordinate boundaries.

## Local Development

```sh
pnpm --filter laymeout build
pnpm --filter laymeout test
pnpm --filter laymeout typecheck
```
