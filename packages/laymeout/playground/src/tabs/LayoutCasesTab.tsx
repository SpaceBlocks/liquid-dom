import { useMemo } from 'react'
import {
  background,
  createLayoutEngine,
  frame,
  hstack,
  overlay,
  padding,
  spacer,
  vstack,
  zstack,
} from 'laymeout'
import type { LayoutDebugStats, LayoutNode, ProposedSize, Size } from 'laymeout'
import {
  formatStats,
  VisualLayoutView,
  visualLeaf,
} from '../lib/visual'
import type { VisualBox } from '../lib/visual'

type LayoutCase = {
  title: string
  root: LayoutNode
  boxes: VisualBox[]
  proposal: ProposedSize
}

export function LayoutCasesTab() {
  const cases = useMemo(() => createCases(), [])

  return (
    <div className="case-grid">
      {cases.map((item) => {
        const result = layoutCase(item)
        return (
          <article className="case-card" key={item.title}>
            <header>
              <h2>{item.title}</h2>
              <span>{result.size.width} x {result.size.height}</span>
            </header>
            <VisualLayoutView root={item.root} boxes={item.boxes} proposal={item.proposal} />
            <pre>{formatStats(result.stats)}</pre>
          </article>
        )
      })}
    </div>
  )
}

function layoutCase(item: LayoutCase): { stats: LayoutDebugStats; size: Size } {
  const engine = createLayoutEngine({ root: item.root })
  const stats = engine.layout(item.proposal)
  engine.dispose()
  const rect = item.root.layout?.rect
  return { stats, size: { width: rect?.width ?? 0, height: rect?.height ?? 0 } }
}

function createCases(): LayoutCase[] {
  const cases: LayoutCase[] = []

  {
    const tool = visualLeaf('tool', { width: 56, height: 34 }, 'Tool', 'teal')
    const mode = visualLeaf('mode', { width: 88, height: 44 }, 'Mode', 'blue')
    const save = visualLeaf('save', { width: 68, height: 34 }, 'Save', 'red')
    cases.push({
      title: 'HStack + Spacer',
      root: hstack({ spacing: 8, alignment: 'center' }, tool.node, mode.node, spacer(), save.node),
      boxes: [tool, mode, save],
      proposal: { width: 420, height: 90 },
    })
  }

  {
    const short = visualLeaf('short', { width: 86, height: 28 }, 'Short', 'teal')
    const wide = visualLeaf('wide', { width: 190, height: 34 }, 'Trailing edge', 'yellow')
    const mid = visualLeaf('mid', { width: 128, height: 28 }, 'Middle', 'blue')
    cases.push({
      title: 'VStack Alignment',
      root: vstack({ spacing: 8, alignment: 'trailing' }, short.node, wide.node, mid.node),
      boxes: [short, wide, mid],
      proposal: { width: 220, height: 140 },
    })
  }

  {
    const panel = visualLeaf('panel', { width: 260, height: 120 }, 'Base', 'gray')
    const badge = visualLeaf('badge', { width: 96, height: 38 }, 'Badge', 'red')
    cases.push({
      title: 'ZStack',
      root: zstack({ alignment: 'bottomTrailing' }, panel.node, badge.node),
      boxes: [panel, badge],
      proposal: { width: 280, height: 150 },
    })
  }

  {
    const content = visualLeaf('content', { width: 118, height: 38 }, 'Padded', 'teal')
    cases.push({
      title: 'Frame + Padding',
      root: frame(padding(content.node, 14), {
        width: 230,
        height: 96,
        alignment: 'bottomTrailing',
      }),
      boxes: [content],
      proposal: { width: 240, height: 110 },
    })
  }

  {
    const label = visualLeaf('label', { width: 116, height: 34 }, 'Content owns size', 'blue')
    const bg = visualLeaf('bg', { width: 260, height: 92 }, 'Background', 'yellow')
    cases.push({
      title: 'Background',
      root: background(padding(label.node, 10), bg.node),
      boxes: [label, bg],
      proposal: { width: 280, height: 120 },
    })
  }

  {
    const card = visualLeaf('card', { width: 210, height: 92 }, 'Card', 'gray')
    const ring = visualLeaf('ring', { width: 246, height: 122 }, 'Overlay can overflow', 'red')
    cases.push({
      title: 'Overlay',
      root: overlay(card.node, ring.node),
      boxes: [card, ring],
      proposal: { width: 280, height: 140 },
    })
  }

  {
    const alpha = visualLeaf('alpha', { width: 150, height: 26 }, 'row: alpha', 'teal')
    const bravo = visualLeaf('bravo', { width: 120, height: 26 }, 'row: bravo', 'blue')
    const charlie = visualLeaf('charlie', { width: 174, height: 26 }, 'row: charlie', 'red')
    cases.push({
      title: 'Dynamic Children',
      root: vstack({ spacing: 6, alignment: 'leading' }, [alpha.node, bravo.node, charlie.node]),
      boxes: [alpha, bravo, charlie],
      proposal: { width: 240, height: 120 },
    })
  }

  return cases
}
