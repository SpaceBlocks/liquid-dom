import type { Container } from '../scene'
import type { BackdropMetrics } from '../types'
import { GPU_BUFFER_USAGE } from './gpu-constants'
import { BACKDROP_METRICS_BUFFER_SIZE, parseBackdropMetrics } from './metrics'

export type BackdropMetricsState = {
  container: Container
  readbackBuffer: GPUBuffer | null
  metrics: BackdropMetrics | null
  pendingReadback: boolean
  inScene: boolean
  cleanupAfterPending: boolean
}

export class BackdropMetricsTracker {
  private device: GPUDevice | null = null
  private readonly stateByContainer = new WeakMap<Container, BackdropMetricsState>()
  private readonly trackedContainers = new Set<Container>()
  private readonly pendingStates = new Set<BackdropMetricsState>()

  constructor(private readonly isDestroyed: () => boolean) {}

  setDevice(device: GPUDevice) {
    this.device = device

    for (const container of this.trackedContainers) {
      const state = this.stateByContainer.get(container)
      if (state) {
        this.ensureResources(state)
      }
    }
  }

  setTracking(container: Container, enabled: boolean) {
    if (enabled) {
      const state = this.getOrCreateState(container)
      state.cleanupAfterPending = false
      this.trackedContainers.add(container)
      this.ensureResources(state)
      return
    }

    this.trackedContainers.delete(container)
    const state = this.stateByContainer.get(container)
    if (!state) {
      return
    }

    state.metrics = null
    state.inScene = false

    if (state.pendingReadback) {
      state.cleanupAfterPending = true
      return
    }

    this.cleanupState(state)
  }

  getMetrics(container: Container) {
    if (!this.trackedContainers.has(container)) {
      return null
    }

    const state = this.stateByContainer.get(container)
    if (!state || !state.inScene) {
      return null
    }

    return state.metrics
  }

  getTrackedState(container: Container) {
    if (!this.trackedContainers.has(container)) {
      return null
    }

    return this.getOrCreateState(container)
  }

  ensureResources(state: BackdropMetricsState) {
    if (!this.device || state.readbackBuffer) {
      return
    }

    state.readbackBuffer = this.device.createBuffer({
      size: BACKDROP_METRICS_BUFFER_SIZE,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST,
    })
  }

  markSceneMembership(seenContainers: Set<Container>) {
    for (const container of this.trackedContainers) {
      const state = this.stateByContainer.get(container)
      if (!state) {
        continue
      }

      state.inScene = seenContainers.has(container)
      if (!state.inScene) {
        state.metrics = null
      }
    }
  }

  scheduleReadback(state: BackdropMetricsState) {
    const readbackBuffer = state.readbackBuffer
    if (!readbackBuffer || state.pendingReadback) {
      return
    }

    state.pendingReadback = true
    this.pendingStates.add(state)

    void readbackBuffer
      .mapAsync(GPUMapMode.READ)
      .then(() => {
        if (this.isDestroyed() || !this.trackedContainers.has(state.container) || !state.inScene) {
          state.metrics = null
          return
        }

        const nextMetrics = parseBackdropMetrics(readbackBuffer)
        if (!nextMetrics) {
          state.metrics = null
          return
        }

        state.metrics = nextMetrics
      })
      .catch((error) => {
        if (!this.isDestroyed() && !state.cleanupAfterPending) {
          console.error(error)
        }
        state.metrics = null
      })
      .finally(() => {
        if (readbackBuffer.mapState === 'mapped') {
          readbackBuffer.unmap()
        }

        state.pendingReadback = false
        this.pendingStates.delete(state)

        if (this.isDestroyed() || state.cleanupAfterPending) {
          this.cleanupState(state)
        }
      })
  }

  destroy() {
    for (const container of this.trackedContainers) {
      const state = this.stateByContainer.get(container)
      if (!state) {
        continue
      }

      if (state.pendingReadback) {
        state.cleanupAfterPending = true
      } else {
        this.cleanupState(state)
      }
    }
    this.trackedContainers.clear()

    for (const state of this.pendingStates) {
      state.cleanupAfterPending = true
    }
  }

  private getOrCreateState(container: Container) {
    let state = this.stateByContainer.get(container)
    if (state) {
      return state
    }

    state = {
      container,
      readbackBuffer: null,
      metrics: null,
      pendingReadback: false,
      inScene: false,
      cleanupAfterPending: false,
    }
    this.stateByContainer.set(container, state)
    return state
  }

  private cleanupState(state: BackdropMetricsState) {
    if (state.pendingReadback) {
      state.cleanupAfterPending = true
      return
    }

    state.metrics = null
    state.inScene = false
    state.cleanupAfterPending = false
    this.pendingStates.delete(state)
    state.readbackBuffer?.destroy()
    state.readbackBuffer = null
  }
}
