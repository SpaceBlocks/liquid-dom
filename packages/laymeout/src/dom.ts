import { leaf } from './layouts'
import type { LeafNode, ProposedSize, Size } from './types'

export type DomLeafSizing = 'border-box' | 'proposal-width'

export type DomLeafOptions = {
  element: HTMLElement
  sizing?: DomLeafSizing
  measureKey?: unknown
}

export function domLeaf(options: DomLeafOptions): LeafNode {
  const sizing = options.sizing ?? 'border-box'

  return leaf({
    measureKey: options.measureKey ?? domMeasureKey(options.element, sizing),
    subscriptionKey: options.element,
    measure: (proposal) => measureElement(options.element, proposal, sizing),
    subscribe: (notify) => subscribeElement(options.element, notify),
  })
}

function measureElement(element: HTMLElement, proposal: ProposedSize, sizing: DomLeafSizing): Size {
  return measureWithClone(element, sizing, sizing === 'proposal-width' ? proposal.width : undefined)
}

function measureWithClone(element: HTMLElement, sizing: DomLeafSizing, proposedWidth: number | undefined): Size {
  const clone = element.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.style.position = 'absolute'
  clone.style.visibility = 'hidden'
  clone.style.pointerEvents = 'none'
  clone.style.contain = 'layout style paint'
  clone.style.left = '-100000px'
  clone.style.top = '0'
  clone.style.transform = 'none'

  if (sizing === 'proposal-width') {
    clone.style.height = 'auto'
    clone.style.minHeight = element.style.minHeight
    clone.style.maxHeight = 'none'
    if (proposedWidth === undefined) {
      clone.style.width = 'max-content'
      clone.style.maxWidth = 'none'
    } else {
      clone.style.width = `${Math.max(0, proposedWidth)}px`
      clone.style.maxWidth = `${Math.max(0, proposedWidth)}px`
    }
  } else if (!clone.style.width) {
    clone.style.width = 'max-content'
  }

  clone.style.boxSizing = 'border-box'
  document.body.append(clone)

  const rect = clone.getBoundingClientRect()
  const size = {
    width: rect.width || clone.offsetWidth || clone.scrollWidth || proposedWidth || 0,
    height: rect.height || clone.offsetHeight || clone.scrollHeight,
  }

  clone.remove()

  return size
}

function subscribeElement(
  element: HTMLElement,
  notify: (cause?: unknown) => void,
): () => void {
  const cleanups: (() => void)[] = []
  let lastSize = readObservedSize(element)

  if ('ResizeObserver' in globalThis) {
    const observer = new ResizeObserver((entries) => {
      const nextSize = readObservedSize(element, entries[0])
      if (!sizeChanged(lastSize, nextSize)) return

      lastSize = nextSize
      notify()
    })
    observer.observe(element)
    cleanups.push(() => observer.disconnect())
  }

  if ('MutationObserver' in globalThis) {
    const observer = new MutationObserver(() => notify())
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      characterData: true,
      childList: true,
      subtree: true,
    })
    cleanups.push(() => observer.disconnect())
  }

  const images = element instanceof HTMLImageElement ? [element] : [...element.querySelectorAll('img')]
  for (const image of images) {
    const listener = () => notify()
    image.addEventListener('load', listener)
    image.addEventListener('error', listener)
    cleanups.push(() => {
      image.removeEventListener('load', listener)
      image.removeEventListener('error', listener)
    })
  }

  const fonts = document.fonts
  if (fonts) {
    void fonts.ready.then(() => notify())
    if ('addEventListener' in fonts && 'removeEventListener' in fonts) {
      const listener = () => notify()
      fonts.addEventListener('loadingdone', listener)
      fonts.addEventListener('loadingerror', listener)
      cleanups.push(() => {
        fonts.removeEventListener('loadingdone', listener)
        fonts.removeEventListener('loadingerror', listener)
      })
    }
  }

  return () => {
    for (const cleanup of cleanups) cleanup()
  }
}

function readObservedSize(element: HTMLElement, entry?: ResizeObserverEntry): Size {
  const borderBox = entry?.borderBoxSize
  const firstBorderBox = Array.isArray(borderBox) ? borderBox[0] : borderBox
  if (firstBorderBox) {
    return {
      width: firstBorderBox.inlineSize,
      height: firstBorderBox.blockSize,
    }
  }

  if (entry?.contentRect) {
    return {
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    }
  }

  const rect = element.getBoundingClientRect()
  return {
    width: rect.width || element.offsetWidth || element.scrollWidth,
    height: rect.height || element.offsetHeight || element.scrollHeight,
  }
}

function sizeChanged(left: Size, right: Size) {
  return Math.abs(left.width - right.width) > 0.5 || Math.abs(left.height - right.height) > 0.5
}

function domMeasureKey(element: HTMLElement, sizing: DomLeafSizing) {
  return {
    sizing,
    className: element.className,
    textContent: element.textContent,
    inlineStyle: element.getAttribute('style'),
    childCount: element.childElementCount,
  }
}
