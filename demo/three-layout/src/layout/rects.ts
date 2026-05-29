import type { Rect } from '@liquid-dom/layout'
import type { RenderRect } from '../types'
import { stackRenderOffsetY } from './layoutState'

export function renderRectForLayoutRect(rect: Rect, width: number, height: number): RenderRect {
  return {
    x: rect.x + rect.width * 0.5 - width * 0.5,
    y: height * 0.5 - (rect.y + rect.height * 0.5) + stackRenderOffsetY(),
    width: rect.width,
    height: rect.height,
  }
}
