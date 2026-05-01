import { BaseLayoutNode, normalizeChildInputs, splitOptions } from './node'
import type {
  Alignment,
  Axis,
  ChildInput,
  CustomLayoutNode,
  DecorationNode,
  FrameNode,
  Insets,
  InsetsInput,
  LayoutChild,
  LayoutMeasureInput,
  LayoutNode,
  LayoutPlaceInput,
  LeafMeasure,
  LeafNode,
  LeafSubscribe,
  Length,
  NoopNode,
  PaddingNode,
  ProposedSize,
  Rect,
  Size,
  SpacerNode,
  StackAlignment,
  StackNode,
  ZStackNode,
} from './types'
import {
  addInsets,
  alignRect,
  clampSize,
  crossAxisOffset,
  insetRect,
  normalizeInsets,
  normalizeLength,
  sanitizeProposal,
  sanitizeSize,
  sizeToProposal,
  stableSerialize,
  subtractInsets,
} from './utils'

export type StackOptions = {
  spacing?: number
  alignment?: StackAlignment
}

export type ZStackOptions = {
  alignment?: Alignment
}

export type FrameOptions = {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  idealWidth?: number
  idealHeight?: number
  maxWidth?: Length
  maxHeight?: Length
  alignment?: Alignment
}

export type PaddingOptions = {
  insets?: InsetsInput
}

export type DecorationOptions = {
  alignment?: Alignment
}

export type SpacerOptions = {
  minLength?: number
}

export type LeafSpec = {
  measure: LeafMeasure
  subscribe?: LeafSubscribe
  measureKey?: unknown
}

export type DefineLayoutOptions = {
  kind: string
  props?: unknown
  measure: (input: LayoutMeasureInput) => Size
  place: (input: LayoutPlaceInput) => void
}

export function leaf(spec: LeafSpec): LeafNode {
  return new LeafLayoutNode(spec)
}

export function spacer(options: SpacerOptions = {}): SpacerNode {
  return new SpacerLayoutNode(options)
}

export function hstack(options: StackOptions, ...children: ChildInput[]): StackNode
export function hstack(...children: ChildInput[]): StackNode
export function hstack(...args: unknown[]): StackNode {
  const parsed = splitOptions<StackOptions>(args, { spacing: 0, alignment: 'center' })
  return new StackLayoutNode('horizontal', parsed.options, normalizeChildInputs(parsed.children))
}

export function vstack(options: StackOptions, ...children: ChildInput[]): StackNode
export function vstack(...children: ChildInput[]): StackNode
export function vstack(...args: unknown[]): StackNode {
  const parsed = splitOptions<StackOptions>(args, { spacing: 0, alignment: 'center' })
  return new StackLayoutNode('vertical', parsed.options, normalizeChildInputs(parsed.children))
}

export function zstack(options: ZStackOptions, ...children: ChildInput[]): ZStackNode
export function zstack(...children: ChildInput[]): ZStackNode
export function zstack(...args: unknown[]): ZStackNode {
  const parsed = splitOptions<ZStackOptions>(args, { alignment: 'center' })
  return new ZStackLayoutNode(parsed.options, normalizeChildInputs(parsed.children))
}

export function frame(node: LayoutNode, options?: FrameOptions): FrameNode
export function frame(options?: FrameOptions): FrameNode
export function frame(input?: LayoutNode | FrameOptions, options: FrameOptions = {}): FrameNode {
  if (isRetainedNode(input)) {
    return new FrameLayoutNode(options, [input])
  }
  return new FrameLayoutNode((input ?? {}) as FrameOptions, [])
}

export function padding(node: LayoutNode, insets?: InsetsInput): PaddingNode
export function padding(node: LayoutNode, options?: PaddingOptions): PaddingNode
export function padding(options?: InsetsInput | PaddingOptions): PaddingNode
export function padding(
  input?: LayoutNode | InsetsInput | PaddingOptions,
  insetsOrOptions?: InsetsInput | PaddingOptions,
): PaddingNode {
  if (isRetainedNode(input)) {
    return new PaddingLayoutNode(parsePaddingOptions(insetsOrOptions), [input])
  }
  return new PaddingLayoutNode(parsePaddingOptions(input), [])
}

export function noop(child?: LayoutNode): NoopNode {
  return new NoopLayoutNode(child ? [child] : [])
}

export function background(
  content: LayoutNode,
  decoration: LayoutNode,
  options: DecorationOptions = {},
): DecorationNode {
  return new DecorationLayoutNode('background', options, [content, decoration])
}

export function overlay(
  content: LayoutNode,
  decoration: LayoutNode,
  options: DecorationOptions = {},
): DecorationNode {
  return new DecorationLayoutNode('overlay', options, [content, decoration])
}

export function defineLayout(
  options: DefineLayoutOptions,
  ...children: ChildInput[]
): CustomLayoutNode {
  return new CustomRetainedLayoutNode(options, normalizeChildInputs(children))
}

class LeafLayoutNode extends BaseLayoutNode implements LeafNode {
  private _measure: LeafMeasure
  private _subscribe: LeafSubscribe | undefined
  private _measureKey: unknown

  constructor(spec: LeafSpec) {
    super('leaf')
    this._measure = spec.measure
    this._subscribe = spec.subscribe
    this._measureKey = spec.measureKey
  }

  get measure(): LeafMeasure {
    return this._measure
  }

  set measure(value: LeafMeasure) {
    if (Object.is(this._measure, value)) return
    this._measure = value
    this.markMeasureDirty()
  }

  get subscribe(): LeafSubscribe | undefined {
    return this._subscribe
  }

  set subscribe(value: LeafSubscribe | undefined) {
    if (Object.is(this._subscribe, value)) return
    this._subscribe = value
    this.notifyTreeChanged()
  }

  get measureKey(): unknown {
    return this._measureKey
  }

  set measureKey(value: unknown) {
    if (Object.is(this._measureKey, value)) return
    this._measureKey = value
    this.markMeasureDirty()
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    return sanitizeSize(this._measure(input.proposal, this))
  }

  override getMeasureKey(): unknown {
    return this._measureKey
  }

  override getSubscriptionSpec() {
    return {
      subscribe: this._subscribe,
    }
  }

  invalidateMeasure(_cause?: unknown) {
    this.markMeasureDirty()
  }
}

class SpacerLayoutNode extends BaseLayoutNode implements SpacerNode {
  private _minLength: number

  constructor(options: SpacerOptions) {
    super('spacer', { isSpacer: true })
    this._minLength = options.minLength ?? 0
  }

  get minLength(): number {
    return this._minLength
  }

  set minLength(value: number) {
    const next = sanitizeLength(value)
    if (this._minLength === next) return
    this._minLength = next
    this.markMeasureDirty()
  }

  override measureSelf(): Size {
    return { width: this._minLength, height: this._minLength }
  }
}

class StackLayoutNode extends BaseLayoutNode implements StackNode {
  private readonly axis: Axis
  private _spacing: number
  private _alignment: StackAlignment

  constructor(axis: Axis, options: StackOptions, children: LayoutNode[]) {
    super(axis === 'horizontal' ? 'hstack' : 'vstack')
    this.axis = axis
    this._spacing = options.spacing ?? 0
    this._alignment = options.alignment ?? 'center'
    this.append(...children)
  }

  get spacing(): number {
    return this._spacing
  }

  set spacing(value: number) {
    const next = sanitizeLength(value)
    if (this._spacing === next) return
    this._spacing = next
    this.markMeasureDirty()
  }

  get alignment(): StackAlignment {
    return this._alignment
  }

  set alignment(value: StackAlignment) {
    if (this._alignment === value) return
    this._alignment = value
    this.markPlacementDirty()
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    return measureStack(this.axis, input.proposal, input.children, {
      spacing: this._spacing,
      alignment: this._alignment,
    })
  }

  override placeChildren(input: LayoutPlaceInput): void {
    placeStack(this.axis, input.bounds, input.proposal, input.children, {
      spacing: this._spacing,
      alignment: this._alignment,
    })
  }
}

class ZStackLayoutNode extends BaseLayoutNode implements ZStackNode {
  private _alignment: Alignment

  constructor(options: ZStackOptions, children: LayoutNode[]) {
    super('zstack')
    this._alignment = options.alignment ?? 'center'
    this.append(...children)
  }

  get alignment(): Alignment {
    return this._alignment
  }

  set alignment(value: Alignment) {
    if (stableSerialize(this._alignment) === stableSerialize(value)) return
    this._alignment = value
    this.markPlacementDirty()
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    let width = 0
    let height = 0
    for (const child of input.children) {
      const childSize = child.measure(input.proposal)
      width = Math.max(width, childSize.width)
      height = Math.max(height, childSize.height)
    }
    return { width, height }
  }

  override placeChildren(input: LayoutPlaceInput): void {
    for (const child of input.children) {
      const childSize = child.measure(input.proposal)
      child.place(alignRect(childSize, input.bounds, this._alignment), sizeToProposal(childSize))
    }
  }
}

class FrameLayoutNode extends BaseLayoutNode implements FrameNode {
  private _width: number | undefined
  private _height: number | undefined
  private _minWidth: number | undefined
  private _minHeight: number | undefined
  private _idealWidth: number | undefined
  private _idealHeight: number | undefined
  private _maxWidth: Length | undefined
  private _maxHeight: Length | undefined
  private _alignment: Alignment

  constructor(options: FrameOptions, children: LayoutNode[]) {
    super('frame')
    this._width = sanitizeOptionalLength(options.width)
    this._height = sanitizeOptionalLength(options.height)
    this._minWidth = sanitizeOptionalLength(options.minWidth)
    this._minHeight = sanitizeOptionalLength(options.minHeight)
    this._idealWidth = sanitizeOptionalLength(options.idealWidth)
    this._idealHeight = sanitizeOptionalLength(options.idealHeight)
    this._maxWidth = options.maxWidth
    this._maxHeight = options.maxHeight
    this._alignment = options.alignment ?? 'center'
    this.append(...children)
  }

  get width(): number | undefined {
    return this._width
  }

  set width(value: number | undefined) {
    const next = sanitizeOptionalLength(value)
    if (Object.is(this._width, next)) return
    this._width = next
    this.markMeasureDirty()
  }

  get height(): number | undefined {
    return this._height
  }

  set height(value: number | undefined) {
    const next = sanitizeOptionalLength(value)
    if (Object.is(this._height, next)) return
    this._height = next
    this.markMeasureDirty()
  }

  get minWidth(): number | undefined {
    return this._minWidth
  }

  set minWidth(value: number | undefined) {
    const next = sanitizeOptionalLength(value)
    if (Object.is(this._minWidth, next)) return
    this._minWidth = next
    this.markMeasureDirty()
  }

  get minHeight(): number | undefined {
    return this._minHeight
  }

  set minHeight(value: number | undefined) {
    const next = sanitizeOptionalLength(value)
    if (Object.is(this._minHeight, next)) return
    this._minHeight = next
    this.markMeasureDirty()
  }

  get idealWidth(): number | undefined {
    return this._idealWidth
  }

  set idealWidth(value: number | undefined) {
    const next = sanitizeOptionalLength(value)
    if (Object.is(this._idealWidth, next)) return
    this._idealWidth = next
    this.markMeasureDirty()
  }

  get idealHeight(): number | undefined {
    return this._idealHeight
  }

  set idealHeight(value: number | undefined) {
    const next = sanitizeOptionalLength(value)
    if (Object.is(this._idealHeight, next)) return
    this._idealHeight = next
    this.markMeasureDirty()
  }

  get maxWidth(): Length | undefined {
    return this._maxWidth
  }

  set maxWidth(value: Length | undefined) {
    if (Object.is(this._maxWidth, value)) return
    this._maxWidth = value
    this.markMeasureDirty()
  }

  get maxHeight(): Length | undefined {
    return this._maxHeight
  }

  set maxHeight(value: Length | undefined) {
    if (Object.is(this._maxHeight, value)) return
    this._maxHeight = value
    this.markMeasureDirty()
  }

  get alignment(): Alignment {
    return this._alignment
  }

  set alignment(value: Alignment) {
    if (stableSerialize(this._alignment) === stableSerialize(value)) return
    this._alignment = value
    this.markPlacementDirty()
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    const child = input.children[0]
    if (!child) return { width: 0, height: 0 }
    const props = this.runtimeProps()
    const childProposal = frameChildProposal(input.proposal, props)
    const childSize = child.measure(childProposal)
    return frameReportedSize(childSize, input.proposal, props)
  }

  override placeChildren(input: LayoutPlaceInput): void {
    const child = input.children[0]
    if (!child) return
    const props = this.runtimeProps()
    const childProposal = frameChildProposal(input.proposal, props)
    const childSize = child.measure(childProposal)
    child.place(alignRect(childSize, input.bounds, props.alignment), sizeToProposal(childSize))
  }

  private runtimeProps(): FrameRuntimeProps {
    return {
      width: this._width,
      height: this._height,
      minWidth: this._minWidth,
      minHeight: this._minHeight,
      idealWidth: this._idealWidth,
      idealHeight: this._idealHeight,
      maxWidth: normalizeLength(this._maxWidth),
      maxHeight: normalizeLength(this._maxHeight),
      alignment: this._alignment,
    }
  }
}

class PaddingLayoutNode extends BaseLayoutNode implements PaddingNode {
  private _insets: Insets

  constructor(options: PaddingOptions, children: LayoutNode[]) {
    super('padding')
    this._insets = normalizeInsets(options.insets)
    this.append(...children)
  }

  get insets(): Insets {
    return this._insets
  }

  set insets(value: InsetsInput) {
    const next = normalizeInsets(value)
    if (stableSerialize(this._insets) === stableSerialize(next)) return
    this._insets = next
    this.markMeasureDirty()
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    const child = input.children[0]
    if (!child) return { width: 0, height: 0 }
    return addInsets(child.measure(subtractInsets(input.proposal, this._insets)), this._insets)
  }

  override placeChildren(input: LayoutPlaceInput): void {
    const child = input.children[0]
    if (!child) return
    child.place(insetRect(input.bounds, this._insets), subtractInsets(input.proposal, this._insets))
  }
}

class NoopLayoutNode extends BaseLayoutNode implements NoopNode {
  constructor(children: LayoutNode[]) {
    super('noop')
    this.append(...children)
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    return input.children[0]?.measure(input.proposal) ?? { width: 0, height: 0 }
  }

  override placeChildren(input: LayoutPlaceInput): void {
    input.children[0]?.place(input.bounds, input.proposal)
  }
}

class DecorationLayoutNode extends BaseLayoutNode implements DecorationNode {
  private _alignment: Alignment

  constructor(kind: 'background' | 'overlay', options: DecorationOptions, children: LayoutNode[]) {
    super(kind)
    this._alignment = options.alignment ?? 'center'
    this.append(...children)
  }

  get alignment(): Alignment {
    return this._alignment
  }

  set alignment(value: Alignment) {
    if (stableSerialize(this._alignment) === stableSerialize(value)) return
    this._alignment = value
    this.markPlacementDirty()
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    return input.children[0]?.measure(input.proposal) ?? { width: 0, height: 0 }
  }

  override placeChildren(input: LayoutPlaceInput): void {
    const contentChild = input.children[0]
    const decorationChild = input.children[1]
    if (!contentChild) return

    contentChild.place(input.bounds, sizeToProposal(input.bounds))
    if (!decorationChild) return

    const decorationProposal = { width: input.bounds.width, height: input.bounds.height }
    const decorationSize = decorationChild.measure(decorationProposal)
    decorationChild.place(alignRect(decorationSize, input.bounds, this._alignment), sizeToProposal(decorationSize))
  }
}

class CustomRetainedLayoutNode extends BaseLayoutNode implements CustomLayoutNode {
  private _props: unknown
  private readonly measureFn: (input: LayoutMeasureInput) => Size
  private readonly placeFn: (input: LayoutPlaceInput) => void

  constructor(options: DefineLayoutOptions, children: LayoutNode[]) {
    super(options.kind)
    this._props = options.props
    this.measureFn = options.measure
    this.placeFn = options.place
    this.append(...children)
  }

  get props(): unknown {
    return this._props
  }

  set props(value: unknown) {
    if (Object.is(this._props, value)) return
    this._props = value
    this.markMeasureDirty()
  }

  override measureSelf(input: LayoutMeasureInput): Size {
    return sanitizeSize(this.measureFn(input))
  }

  override placeChildren(input: LayoutPlaceInput): void {
    this.placeFn(input)
  }
}

type StackRuntimeProps = {
  spacing: number
  alignment: StackAlignment
}

type FrameRuntimeProps = {
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  idealWidth?: number
  idealHeight?: number
  maxWidth?: number
  maxHeight?: number
  alignment: Alignment
}

function measureStack(
  axis: Axis,
  proposal: ProposedSize,
  children: LayoutChild[],
  props: StackRuntimeProps,
): Size {
  const sizes = measureStackChildren(axis, proposal, children)
  const spacing = props.spacing * Math.max(0, children.length - 1)
  const main = sizes.reduce((sum, size) => sum + mainSize(axis, size), 0) + spacing
  const cross = sizes.reduce((max, size) => Math.max(max, crossSize(axis, size)), 0)

  if (axis === 'horizontal') {
    return {
      width: hasSpacer(children) && proposal.width !== undefined ? Math.max(main, proposal.width) : main,
      height: proposal.height !== undefined && hasSpacer(children) ? Math.max(cross, proposal.height) : cross,
    }
  }

  return {
    width: proposal.width !== undefined && hasSpacer(children) ? Math.max(cross, proposal.width) : cross,
    height: hasSpacer(children) && proposal.height !== undefined ? Math.max(main, proposal.height) : main,
  }
}

function placeStack(
  axis: Axis,
  bounds: Rect,
  proposal: ProposedSize,
  children: LayoutChild[],
  props: StackRuntimeProps,
): void {
  const sizes = measureStackChildren(axis, proposal, children)
  const spacing = props.spacing * Math.max(0, children.length - 1)
  const baseMain = sizes.reduce((sum, size) => sum + mainSize(axis, size), 0) + spacing
  const spacerCount = children.filter((child) => child.isSpacer).length
  const extra = spacerCount > 0 ? Math.max(0, mainSize(axis, bounds) - baseMain) / spacerCount : 0
  let cursor = axis === 'horizontal' ? bounds.x : bounds.y

  for (const [index, child] of children.entries()) {
    const measured = sizes[index]
    if (!measured) continue

    const size = child.isSpacer
      ? setMainSize(axis, measured, mainSize(axis, measured) + extra)
      : measured
    const childBounds = rectOnAxis(axis, bounds, cursor, size, props.alignment)
    child.place(childBounds, sizeToProposal(size))
    cursor += mainSize(axis, size) + props.spacing
  }
}

function measureStackChildren(
  axis: Axis,
  proposal: ProposedSize,
  children: LayoutChild[],
): Size[] {
  const childProposal =
    axis === 'horizontal'
      ? sanitizeProposal({ height: proposal.height })
      : sanitizeProposal({ width: proposal.width })

  return children.map((child) => child.measure(childProposal))
}

function frameChildProposal(proposal: ProposedSize, props: FrameRuntimeProps): ProposedSize {
  const next: ProposedSize = {}
  const widthProposal = props.width ?? props.idealWidth ?? clampProposal(proposal.width, props.minWidth, props.maxWidth)
  const heightProposal = props.height ?? props.idealHeight ?? clampProposal(proposal.height, props.minHeight, props.maxHeight)
  if (widthProposal !== undefined) next.width = widthProposal
  if (heightProposal !== undefined) next.height = heightProposal
  return sanitizeProposal(next)
}

function frameReportedSize(childSize: Size, proposal: ProposedSize, props: FrameRuntimeProps): Size {
  const width =
    props.width ??
    (props.maxWidth === Number.POSITIVE_INFINITY && proposal.width !== undefined
      ? Math.max(childSize.width, proposal.width)
      : childSize.width)
  const height =
    props.height ??
    (props.maxHeight === Number.POSITIVE_INFINITY && proposal.height !== undefined
      ? Math.max(childSize.height, proposal.height)
      : childSize.height)

  return clampSize(
    {
      width,
      height,
    },
    props.minWidth,
    props.minHeight,
    props.maxWidth,
    props.maxHeight,
  )
}

function clampProposal(value: number | undefined, min?: number, max?: number): number | undefined {
  if (value === undefined) return undefined
  let next = value
  if (min !== undefined) next = Math.max(min, next)
  if (max !== undefined && Number.isFinite(max)) next = Math.min(max, next)
  return next
}

function hasSpacer(children: LayoutChild[]) {
  return children.some((child) => child.isSpacer)
}

function mainSize(axis: Axis, value: Size | Rect) {
  return axis === 'horizontal' ? value.width : value.height
}

function crossSize(axis: Axis, value: Size | Rect) {
  return axis === 'horizontal' ? value.height : value.width
}

function setMainSize(axis: Axis, size: Size, value: number): Size {
  return axis === 'horizontal' ? { width: value, height: size.height } : { width: size.width, height: value }
}

function rectOnAxis(
  axis: Axis,
  bounds: Rect,
  cursor: number,
  size: Size,
  alignment: StackAlignment,
): Rect {
  if (axis === 'horizontal') {
    return {
      x: cursor,
      y: bounds.y + crossAxisOffset(bounds.height, size.height, alignment),
      width: size.width,
      height: size.height,
    }
  }

  return {
    x: bounds.x + crossAxisOffset(bounds.width, size.width, alignment),
    y: cursor,
    width: size.width,
    height: size.height,
  }
}

function parsePaddingOptions(input: InsetsInput | PaddingOptions | undefined): PaddingOptions {
  if (input && typeof input === 'object' && 'insets' in input) {
    return input as PaddingOptions
  }
  return { insets: input as InsetsInput | undefined }
}

function sanitizeLength(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function sanitizeOptionalLength(value: number | undefined): number | undefined {
  if (value === undefined) return undefined
  return sanitizeLength(value)
}

function isRetainedNode(value: unknown): value is LayoutNode {
  return Boolean(value && typeof value === 'object' && (value as { __laymeout?: unknown }).__laymeout === true)
}

export function propsSignature(value: unknown): string {
  return stableSerialize(value)
}
