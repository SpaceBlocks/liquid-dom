function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeWithDefaults<T>(defaults: T, storedValue: unknown): T {
  if (Array.isArray(defaults)) {
    if (!Array.isArray(storedValue)) {
      return defaults
    }

    return defaults.map((item, index) => mergeWithDefaults(item, storedValue[index])) as T
  }

  if (isRecord(defaults)) {
    if (!isRecord(storedValue)) {
      return defaults
    }

    const nextValue: Record<string, unknown> = { ...defaults }
    for (const key of Object.keys(defaults)) {
      nextValue[key] = mergeWithDefaults(defaults[key as keyof typeof defaults], storedValue[key])
    }
    return nextValue as T
  }

  return (storedValue ?? defaults) as T
}

export function loadStoredState<T>(storageKey: string, defaults: T): T {
  if (typeof window === 'undefined') {
    return defaults
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey)
    if (!storedValue) {
      return defaults
    }

    return mergeWithDefaults(defaults, JSON.parse(storedValue))
  } catch {
    return defaults
  }
}

export function saveStoredState<T>(storageKey: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    return
  }
}
