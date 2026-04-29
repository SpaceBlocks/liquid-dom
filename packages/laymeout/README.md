# laymeout

`laymeout` is a renderer-agnostic TypeScript layout engine inspired by SwiftUI's two-step layout model: parents propose a size, children report a size, then parents place children into rectangles.

It does not render UI by itself. It gives you retained layout nodes with stable ids, mutable layout properties, measurement caching, and calculated geometry written directly to each node. Your DOM, Canvas, SVG, WebGL, native, or custom renderer owns the UI objects and reads `node.layout`.

```sh
npm install laymeout
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

## Mental Model

Nodes are retained mutable objects. Builders such as `hstack`, `vstack`, `frame`, `padding`, and `leaf` return node instances with stable generated ids and property setters.

```ts
const row = hstack({ spacing: 8 })
row.append(title, spacer(), button)

const engine = createLayoutEngine({ root: row })

row.spacing = 16
engine.layout({ width: 800 })
```

A node has one parent. Appending it to another parent automatically detaches it from the old parent, matching DOM parenting.

Layout results are stored on nodes:

```ts
type NodeLayout = {
  rect: Rect // relative to the parent layout node
}
```

Detached nodes keep their last `layout` until they are laid out again. `laymeout` does not add a generation counter; freshness tracking is userland's responsibility if your renderer needs it.

## Rendering Pattern

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

If your renderer skips layout-only intermediary nodes, accumulate ancestor offsets in userland or attach render groups to the intermediary layout nodes that own those coordinate boundaries. Child order, parentage, and traversal are already available from `node.children` and `node.parent`; `laymeout` does not emit a separate output graph.

## Core API

```ts
import {
  background,
  createLayoutEngine,
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

### `createLayoutEngine(options?)`

```ts
const engine = createLayoutEngine({
  root,
  onInvalidate: () => requestAnimationFrame(render),
  maxCachedMeasurements: 50_000,
})

engine.root = root
const stats = engine.layout({ width: 800 })
engine.dispose()
```

```ts
type LayoutEngine = {
  root: LayoutNode | undefined
  layout(proposal: ProposedSize): LayoutDebugStats
  getDebugStats(): LayoutDebugStats
  dispose(): void
}
```

`layout(proposal)` throws until `root` is assigned. It mutates reachable nodes by setting `node.layout`, then returns debug stats only.

Set `maxCachedMeasurements: 0` to disable measurement caching for profiling.

### Retained Nodes

```ts
type LayoutNode = {
  readonly id: string
  readonly kind: string
  readonly parent: LayoutNode | null
  readonly children: readonly LayoutNode[]
  readonly layout: NodeLayout | undefined

  append(...children: LayoutNode[]): void
  prepend(...children: LayoutNode[]): void
  insertBefore(child: LayoutNode, before: LayoutNode): void
  replaceChildren(...children: LayoutNode[]): void
  remove(): void
  dispose(): void
}
```

Ids are generated internally and remain stable for the node lifetime. Core layout identity is the node object, not a user key.

### `leaf(spec)`

Creates a renderer-owned leaf. Leaves define their own measurement behavior.

```ts
const title = leaf({
  measure: (proposal, node) => ({
    width: proposal.width ?? 180,
    height: 32,
  }),
  subscribe: (notify, node) => {
    const unsubscribe = model.onChange(() => notify('model'))
    return unsubscribe
  },
  measureKey: model.version,
  subscriptionKey: model,
})

title.invalidateMeasure('manual')
```

```ts
type LeafSpec = {
  measure: (proposal: ProposedSize, node: LeafNode) => Size
  subscribe?: (notify: (cause?: unknown) => void, node: LeafNode) => void | (() => void)
  measureKey?: unknown
  subscriptionKey?: unknown
}
```

The engine owns subscriptions for reachable leaves. When a subscription calls `notify(cause)`, the leaf and ancestors are marked dirty, `onInvalidate` runs, and cached measurements affected by that leaf are bypassed on the next layout.

If measurement behavior changes outside a subscription, update `measureKey`, replace `measure`, or call `invalidateMeasure()`.

### Stacks

```ts
const row = hstack({ spacing: 8, alignment: 'center' }, left, spacer(), right)
const column = vstack({ spacing: 12, alignment: 'leading' }, title, body)

row.spacing = 16
column.alignment = 'trailing'
```

Stacks measure children along their main axis with fixed spacing. `spacer()` expands in finite proposals.

Stack alignment is cross-axis only:

```ts
type StackAlignment = 'start' | 'center' | 'end' | 'leading' | 'trailing' | 'top' | 'bottom'
```

### `zstack`

```ts
const badge = zstack({ alignment: 'bottomTrailing' }, card, pill)
badge.alignment = 'topTrailing'
```

`zstack` sizes to the maximum child width and height, then places each child inside that shared bounds using `alignment`.

### `frame`

```ts
const framed = frame(child, {
  width: 240,
  minHeight: 48,
  maxWidth: 'infinity',
  alignment: 'bottomTrailing',
})

framed.width = 320
framed.alignment = 'center'
```

`frame` modifies the proposal sent to its child, clamps its reported size, and places the child within the frame bounds.

### `padding`

```ts
const padded = padding(child, { horizontal: 16, vertical: 10 })
padded.insets = 24
```

Insets can be a number, `{ top, right, bottom, left }`, or `{ horizontal, vertical }`. Padding subtracts insets before measuring the child, then adds them back to its own measured size.

### `noop`

```ts
const passthrough = noop(child)
```

`noop` is a single-child layout node that forwards the same proposal to its child and places the child into the same parent-local bounds.

### `background` and `overlay`

```ts
const withBackground = background(content, backgroundNode)
const withOverlay = overlay(content, overlayNode, { alignment: 'topTrailing' })
```

These are layout nodes whose content child determines size. The decoration is placed into the content bounds and does not affect parent layout. Paint order is renderer-owned; the engine only preserves structural children.

### `defineLayout`

Use `defineLayout` for custom containers. `place` is command-style: call `child.place(...)` directly. `bounds` is in the layout node's own local coordinate space, so direct child placements are parent-local rects.

```ts
const flow = defineLayout(
  {
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
  },
  first,
  second,
)
```

## DOM Adapter

```ts
import { domLeaf } from 'laymeout/dom'
```

`domLeaf` creates a retained measured leaf from an existing `HTMLElement`.

```ts
const titleNode = domLeaf({ element: titleEl, sizing: 'proposal-width' })
const actionNode = domLeaf({ element: buttonEl })
```

```ts
type DomLeafOptions = {
  element: HTMLElement
  sizing?: 'border-box' | 'proposal-width'
  measureKey?: unknown
}
```

Measurement uses an offscreen clone so the live element is not mutated during the measure phase. `proposal-width` fixes the clone's width to the proposed width and lets height resolve naturally, which is useful for text wrapping.

The DOM adapter subscribes with `ResizeObserver`, image load/error events, `document.fonts` where available, and DOM mutations that commonly affect intrinsic size. It only invalidates measurement; applying `node.layout` to elements is up to your renderer.

## Caching And Stats

The engine caches measurements by node id, proposal, node revision, subtree revision, and `measureKey`. Placement is recomputed every layout pass.

```ts
type LayoutDebugStats = {
  measureCalls: number
  cacheHits: number
  cacheMisses: number
  invalidations: number
  activeSubscriptions: number
  nodes: number
}
```

`nodes` is the number of nodes placed in the last layout. `invalidations` is cumulative for the engine lifetime.

## Scripts

```sh
npm run dev
npm run typecheck
npm run test
npm run build
npm run playground:build
npm run pack:dry-run
```

The package builds ESM, CJS, and declarations with `tsup`. The playground is development-only and excluded from published package files.

Before publishing, re-check package-name availability with `npm view laymeout`.

## License

MIT
