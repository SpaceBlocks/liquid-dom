# liquid-glass-web

`liquid-glass-web` is a monorepo for WebGPU liquid-glass rendering, React bindings, Three.js integration, React Three Fiber integration, and the renderer-agnostic layout engine used by the higher-level APIs.

The packages are split by integration layer. Use the lowest-level package that matches the renderer you own, or the higher-level React packages when you want retained declarative layout.

## Packages

| Package | Purpose | Use it when |
| --- | --- | --- |
| [`liquid-glass-dom`](./packages/liquid-glass-dom) | Imperative DOM-backed scene graph, WebGPU renderer, reusable glass core, and retained layout classes. | You want direct control over the scene graph or you are building an adapter for another renderer. |
| [`liquid-glass-react`](./packages/liquid-glass-react) | React 19 bindings for the retained layout and glass APIs. | You want to describe glass UI in React and let `LayoutCanvas` own the canvas, or you need a headless retained scene for another renderer. |
| [`liquid-glass-three`](./packages/liquid-glass-three) | Adapter for compositing liquid glass over Three's WebGPU renderer. | You already render a Three WebGPU scene and want liquid glass as a post-composited layer. |
| [`liquid-glass-r3f`](./packages/liquid-glass-r3f) | React Three Fiber bridge built on `liquid-glass-three` and `liquid-glass-react`. | You use R3F with Three's WebGPU renderer and want React liquid-glass UI over the scene. |
| [`laymeout`](./packages/laymeout) | Renderer-agnostic retained layout engine. | You need SwiftUI-style measurement and placement without any renderer dependency. |

## Package Relationships

`laymeout` is independent. `liquid-glass-dom` uses it for the retained layout subpath but also exposes a lower-level imperative scene graph and WebGPU renderer. `liquid-glass-react` wraps the retained DOM layout classes in React components. `liquid-glass-three` hosts the reusable WebGPU core inside a Three WebGPU renderer. `liquid-glass-r3f` combines the React and Three packages for React Three Fiber.

## Installation

Install the package that matches your integration target. Package-specific READMEs list the full install command including peer dependencies.

```sh
pnpm add liquid-glass-dom
pnpm add liquid-glass-react react react-dom
pnpm add liquid-glass-three liquid-glass-dom three
pnpm add liquid-glass-r3f liquid-glass-react @react-three/fiber react react-dom three
pnpm add laymeout
```

## Repository Development

```sh
pnpm install
pnpm -r build
pnpm --filter laymeout test
pnpm --filter liquid-glass-dom test
pnpm --filter liquid-glass-react test
```

Use the package READMEs for package-level build and test commands.

## Browser And Runtime Requirements

The liquid-glass renderer requires WebGPU. DOM-backed `Html` content also requires the experimental HTML-in-Canvas API, which is currently available only behind Chrome's Canvas Draw Element flag: `chrome://flags/#canvas-draw-element`. The implementation uses `<canvas layoutsubtree>` and canvas paint events to copy live DOM content into GPU textures.

The DOM and React packages can build retained scene graphs in any browser-like environment, but rendering requires a browser with `navigator.gpu`; rendering DOM-backed content additionally requires the Chrome flag above. Three integrations require Three's WebGPU renderer, not WebGLRenderer.

Reference: [WICG HTML-in-Canvas](https://wicg.github.io/html-in-canvas/).
