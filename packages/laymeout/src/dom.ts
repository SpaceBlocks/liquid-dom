import { leaf } from './layouts'
import type { LeafNode, ProposedSize, Size } from './types'

export type DomLeafSizing = 'intrinsic' | 'constrained-width' | 'fill'

export type DomMeasureOptions = {
  sizing?: DomLeafSizing
}

export type DomLeafOptions = DomMeasureOptions & {
  element: HTMLElement
  measureKey?: unknown
}

export function domLeaf(options: DomLeafOptions): LeafNode {
  return leaf({
    measureKey: options.measureKey ?? domMeasureKey(options.element, options),
    measure: (proposal) => measureDomElement(options.element, proposal, options),
    subscribe: (notify) => subscribeDomElement(options.element, notify),
  })
}

export function measureDomElement(
  element: HTMLElement,
  proposal: ProposedSize = {},
  options: DomMeasureOptions = {},
): Size {
  const sizing = options.sizing ?? 'intrinsic'
  const proposedWidth = proposal.width
  const proposedHeight = proposal.height
  const acceptsWidth = (sizing === 'constrained-width' || sizing === 'fill') && proposedWidth !== undefined
  const acceptsHeight = sizing === 'fill' && proposedHeight !== undefined
  const acceptedWidth = acceptsWidth ? Math.max(0, proposedWidth!) : undefined
  const acceptedHeight = acceptsHeight ? Math.max(0, proposedHeight!) : undefined
  const wrapper = document.createElement('div')
  const clone = element.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  wrapper.style.position = 'absolute'
  wrapper.style.visibility = 'hidden'
  wrapper.style.pointerEvents = 'none'
  wrapper.style.contain = 'layout style paint'
  wrapper.style.left = '-100000px'
  wrapper.style.top = '0'
  wrapper.style.display = 'inline-block'
  wrapper.style.width = 'max-content'
  wrapper.style.maxWidth = 'none'
  wrapper.style.height = 'auto'
  wrapper.style.maxHeight = 'none'
  clone.style.pointerEvents = 'none'
  clone.style.transform = 'none'

  if (acceptedWidth !== undefined) {
    const width = `${acceptedWidth}px`
    wrapper.style.width = width
    wrapper.style.maxWidth = width
    clone.style.width = width
    clone.style.maxWidth = width
  }

  if (acceptedHeight !== undefined) {
    const height = `${acceptedHeight}px`
    wrapper.style.height = height
    wrapper.style.maxHeight = height
    clone.style.height = height
    clone.style.maxHeight = height
  } else if (sizing === 'constrained-width' || acceptedWidth !== undefined) {
    clone.style.height = 'auto'
    clone.style.minHeight = element.style.minHeight
    clone.style.maxHeight = 'none'
  }

  clone.style.boxSizing = 'border-box'
  wrapper.append(clone)
  document.body.append(wrapper)

  const rect = clone.getBoundingClientRect()
  const wrapperRect = wrapper.getBoundingClientRect()
  const size = {
    width: acceptedWidth !== undefined
      ? acceptedWidth
      : (rect.width || clone.offsetWidth || clone.scrollWidth || wrapperRect.width || 0),
    height: acceptedHeight !== undefined
      ? acceptedHeight
      : (rect.height || clone.offsetHeight || clone.scrollHeight || wrapperRect.height || 0),
  }

  wrapper.remove()

  return size
}

export function subscribeDomElement(
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

function domMeasureKey(element: HTMLElement, options: DomMeasureOptions) {
  return {
    sizing: options.sizing ?? 'intrinsic',
    className: element.className,
    textContent: element.textContent,
    inlineStyle: element.getAttribute('style'),
    childCount: element.childElementCount,
  }
}
