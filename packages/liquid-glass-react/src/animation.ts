type NumericObject = {
  [key: string]: number | NumericObject
}

type AnimationChannel = {
  current: number
  target: number
  velocity: number
}

type AnimationValue =
  | {
      kind: 'number'
      channel: AnimationChannel
    }
  | {
      kind: 'object'
      template: NumericObject
      channels: Map<string, AnimationChannel>
    }

type PropertyAnimation = {
  target: object
  property: string
  value: AnimationValue
  config: Required<SpringTransition>
  listeners: Set<() => void>
}

type TimelineStep =
  | {
      kind: 'to'
      target: object
      values: Record<string, unknown>
      transition?: AnimationConfig
    }
  | {
      kind: 'call'
      callback: () => void
    }

/** Spring transition parameters used by declarative and imperative animations. */
export type SpringTransition = {
  type: 'spring'
  stiffness?: number
  damping?: number
  mass?: number
  velocity?: number
  restSpeed?: number
  restDelta?: number
}

/** Animation transition config accepted by React props and imperative animation calls. */
export type AnimationConfig = SpringTransition | true | false | null | undefined

/** Per-property declarative transition map for a component. */
export type TransitionMap<T extends object = Record<string, unknown>> = Partial<
  Record<Extract<keyof T, string>, AnimationConfig>
> & {
  default?: AnimationConfig
}

/** Declarative transition prop accepted by React layout components. */
export type ComponentTransition<T extends object = Record<string, unknown>> =
  | AnimationConfig
  | TransitionMap<T>

/** Imperative animation handle. */
export type AnimationControls = {
  readonly finished: Promise<void>
  stop: () => void
}

/** Imperative animation function returned by {@link import('./canvas').useAnimate}. */
export type AnimateFunction = <Target extends object>(
  target: Target | null | undefined,
  values: Partial<Target>,
  transition?: AnimationConfig,
) => AnimationControls

function defaultSpring(): Required<SpringTransition> {
  return {
    type: 'spring',
    stiffness: 300,
    damping: 30,
    mass: 1,
    velocity: 0,
    restSpeed: 0.01,
    restDelta: 0.01,
  }
}

/** Creates a spring transition config. */
export function spring(options: Omit<SpringTransition, 'type'> = {}): SpringTransition {
  return {
    type: 'spring',
    ...options,
  }
}

function normalizeSpring(config: AnimationConfig): Required<SpringTransition> | null {
  if (!config) {
    return null
  }

  if (config === true) {
    return defaultSpring()
  }

  return {
    ...defaultSpring(),
    ...config,
    type: 'spring',
  }
}

function isSpringTransition(value: unknown): value is SpringTransition | true {
  return value === true || (
    value !== null &&
    typeof value === 'object' &&
    (
      (value as { type?: unknown }).type === 'spring' ||
      'stiffness' in value ||
      'damping' in value ||
      'mass' in value ||
      'velocity' in value ||
      'restSpeed' in value ||
      'restDelta' in value
    )
  )
}

/** Resolves the transition config that applies to one property. */
export function resolveTransition(
  transition: ComponentTransition | undefined,
  property: string,
): AnimationConfig {
  if (transition === undefined || transition === null || transition === false) {
    return transition
  }

  if (isSpringTransition(transition)) {
    return transition
  }

  return transition[property] ?? transition.default
}

function isPlainObject(value: unknown): value is NumericObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneNumericObject(value: NumericObject): NumericObject {
  const clone: NumericObject = {}
  for (const [key, child] of Object.entries(value)) {
    clone[key] = typeof child === 'number' ? child : cloneNumericObject(child)
  }
  return clone
}

function flattenNumericObject(
  value: NumericObject,
  prefix = '',
  output = new Map<string, number>(),
): Map<string, number> | null {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof child === 'number') {
      output.set(path, child)
    } else if (isPlainObject(child)) {
      if (!flattenNumericObject(child, path, output)) {
        return null
      }
    } else {
      return null
    }
  }

  return output
}

function setPath(target: NumericObject, path: string, value: number) {
  const parts = path.split('.')
  let current = target
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = current[parts[index]] as NumericObject
  }
  current[parts[parts.length - 1]] = value
}

function buildAnimationValue(from: unknown, to: unknown, initialVelocity: number): AnimationValue | null {
  if (typeof from === 'number' && typeof to === 'number') {
    return {
      kind: 'number',
      channel: {
        current: from,
        target: to,
        velocity: initialVelocity,
      },
    }
  }

  if (!isPlainObject(from) || !isPlainObject(to)) {
    return null
  }

  const fromValues = flattenNumericObject(from)
  const toValues = flattenNumericObject(to)
  if (!fromValues || !toValues || fromValues.size === 0 || fromValues.size !== toValues.size) {
    return null
  }

  const channels = new Map<string, AnimationChannel>()
  for (const [path, target] of toValues) {
    const current = fromValues.get(path)
    if (current === undefined) {
      return null
    }
    channels.set(path, {
      current,
      target,
      velocity: initialVelocity,
    })
  }

  return {
    kind: 'object',
    template: cloneNumericObject(to),
    channels,
  }
}

function retargetAnimationValue(value: AnimationValue, to: unknown, initialVelocity: number) {
  if (value.kind === 'number') {
    if (typeof to !== 'number') {
      return false
    }

    value.channel.target = to
    if (initialVelocity !== 0) {
      value.channel.velocity = initialVelocity
    }
    return true
  }

  if (!isPlainObject(to)) {
    return false
  }

  const toValues = flattenNumericObject(to)
  if (!toValues || toValues.size !== value.channels.size) {
    return false
  }

  for (const [path, channel] of value.channels) {
    const target = toValues.get(path)
    if (target === undefined) {
      return false
    }
    channel.target = target
    if (initialVelocity !== 0) {
      channel.velocity = initialVelocity
    }
  }
  value.template = cloneNumericObject(to)
  return true
}

function materializeValue(value: AnimationValue): unknown {
  if (value.kind === 'number') {
    return value.channel.current
  }

  const output = cloneNumericObject(value.template)
  for (const [path, channel] of value.channels) {
    setPath(output, path, channel.current)
  }
  return output
}

function getChannels(value: AnimationValue): AnimationChannel[] {
  return value.kind === 'number' ? [value.channel] : [...value.channels.values()]
}

function isSettled(channel: AnimationChannel, config: Required<SpringTransition>) {
  return (
    Math.abs(channel.velocity) <= config.restSpeed &&
    Math.abs(channel.target - channel.current) <= config.restDelta
  )
}

function stepChannel(channel: AnimationChannel, config: Required<SpringTransition>, deltaSeconds: number) {
  const displacement = channel.current - channel.target
  const springForce = -config.stiffness * displacement
  const dampingForce = -config.damping * channel.velocity
  const acceleration = (springForce + dampingForce) / config.mass
  channel.velocity += acceleration * deltaSeconds
  channel.current += channel.velocity * deltaSeconds

  if (isSettled(channel, config)) {
    channel.current = channel.target
    channel.velocity = 0
  }
}

function assignProperty(target: object, property: string, value: unknown) {
  const writableTarget = target as Record<string, unknown>
  writableTarget[property] = value
}

function resolveFinished() {
  return Promise.resolve()
}

/**
 * Retained animation scheduler ticked by LayoutCanvas' RAF loop.
 */
export class AnimationManager {
  private readonly animations = new Set<PropertyAnimation>()
  private readonly animationsByTarget = new WeakMap<object, Map<string, PropertyAnimation>>()

  /** Whether any animations are currently active. */
  get active(): boolean {
    return this.animations.size > 0
  }

  /** Starts or retargets spring animations for the provided properties. */
  animate<Target extends object>(
    target: Target | null | undefined,
    values: Partial<Target>,
    transition: AnimationConfig = true,
  ): AnimationControls {
    const config = normalizeSpring(transition)
    if (!target || !config) {
      return {
        finished: resolveFinished(),
        stop: () => undefined,
      }
    }

    let remaining = 0
    let resolve: () => void = () => undefined
    const finished = new Promise<void>((done) => {
      resolve = done
    })
    const cleanups: (() => void)[] = []

    for (const [property, nextValue] of Object.entries(values)) {
      const currentValue = (target as Record<string, unknown>)[property]
      const targetAnimations = this.getTargetAnimations(target)
      const existing = targetAnimations.get(property)
      if (existing && retargetAnimationValue(existing.value, nextValue, config.velocity)) {
        existing.config = config
        remaining += 1
        const listener = () => {
          remaining -= 1
          if (remaining === 0) {
            resolve()
          }
        }
        existing.listeners.add(listener)
        cleanups.push(() => existing.listeners.delete(listener))
        continue
      }

      existing && this.finishAnimation(existing, false)
      const value = buildAnimationValue(currentValue, nextValue, config.velocity)
      if (!value) {
        assignProperty(target, property, nextValue)
        continue
      }

      const animation: PropertyAnimation = {
        target,
        property,
        value,
        config,
        listeners: new Set(),
      }
      remaining += 1
      const listener = () => {
        remaining -= 1
        if (remaining === 0) {
          resolve()
        }
      }
      animation.listeners.add(listener)
      cleanups.push(() => animation.listeners.delete(listener))
      this.animations.add(animation)
      targetAnimations.set(property, animation)
    }

    if (remaining === 0) {
      resolve()
    }

    return {
      finished,
      stop: () => {
        for (const cleanup of cleanups) {
          cleanup()
        }
        for (const [property] of Object.entries(values)) {
          const animation = this.animationsByTarget.get(target)?.get(property)
          if (animation) {
            this.finishAnimation(animation, false)
          }
        }
        resolve()
      },
    }
  }

  /** Stops all animations for a target, or only the listed properties. */
  stop(target: object, properties?: readonly string[]) {
    const targetAnimations = this.animationsByTarget.get(target)
    if (!targetAnimations) {
      return
    }

    const keys = properties ?? [...targetAnimations.keys()]
    for (const property of keys) {
      const animation = targetAnimations.get(property)
      if (animation) {
        this.finishAnimation(animation, false)
      }
    }
  }

  /** Advances active animations by one RAF delta. */
  tick(deltaMilliseconds: number): boolean {
    if (this.animations.size === 0) {
      return false
    }

    const deltaSeconds = Math.min(0.064, Math.max(0, deltaMilliseconds / 1000))
    const stepCount = Math.max(1, Math.ceil(deltaSeconds / (1 / 60)))
    const stepSeconds = deltaSeconds / stepCount

    for (const animation of [...this.animations]) {
      for (let step = 0; step < stepCount; step += 1) {
        for (const channel of getChannels(animation.value)) {
          stepChannel(channel, animation.config, stepSeconds)
        }
      }

      assignProperty(animation.target, animation.property, materializeValue(animation.value))
      if (getChannels(animation.value).every((channel) => isSettled(channel, animation.config))) {
        this.finishAnimation(animation, true)
      }
    }

    return true
  }

  private getTargetAnimations(target: object) {
    const existing = this.animationsByTarget.get(target)
    if (existing) {
      return existing
    }

    const animations = new Map<string, PropertyAnimation>()
    this.animationsByTarget.set(target, animations)
    return animations
  }

  private finishAnimation(animation: PropertyAnimation, snapToTarget: boolean) {
    if (snapToTarget) {
      for (const channel of getChannels(animation.value)) {
        channel.current = channel.target
        channel.velocity = 0
      }
      assignProperty(animation.target, animation.property, materializeValue(animation.value))
    }

    this.animations.delete(animation)
    this.animationsByTarget.get(animation.target)?.delete(animation.property)
    for (const listener of [...animation.listeners]) {
      listener()
    }
    animation.listeners.clear()
  }
}

/**
 * Imperative sequence builder for animations that should run one after another.
 */
export class AnimationTimeline {
  private readonly steps: TimelineStep[] = []
  private currentControls: AnimationControls | null = null
  private stopped = false

  constructor(
    private readonly manager: AnimationManager,
    private readonly requestFrame: () => void,
    private readonly defaultTransition: AnimationConfig = true,
  ) {}

  /** Adds an animation step to the sequence. */
  to<Target extends object>(
    target: Target | null | undefined,
    values: Partial<Target>,
    transition?: AnimationConfig,
  ): this {
    if (target) {
      this.steps.push({
        kind: 'to',
        target,
        values: values as Record<string, unknown>,
        transition,
      })
    }
    return this
  }

  /** Adds a synchronous callback step to the sequence. */
  call(callback: () => void): this {
    this.steps.push({ kind: 'call', callback })
    return this
  }

  /** Starts the sequence. */
  play(): AnimationControls {
    this.stopped = false
    const finished = this.run()
    return {
      finished,
      stop: () => this.stop(),
    }
  }

  /** Stops the currently running step. */
  stop() {
    this.stopped = true
    this.currentControls?.stop()
    this.currentControls = null
  }

  private async run() {
    for (const step of this.steps) {
      if (this.stopped) {
        return
      }

      if (step.kind === 'call') {
        step.callback()
        continue
      }

      this.currentControls = this.manager.animate(
        step.target,
        step.values,
        step.transition ?? this.defaultTransition,
      )
      this.requestFrame()
      await this.currentControls.finished
      this.currentControls = null
    }
  }
}
