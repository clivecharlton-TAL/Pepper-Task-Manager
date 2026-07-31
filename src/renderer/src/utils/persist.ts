// Tiny localStorage wrapper for UI preferences that should survive a restart.
// Reads are defensive: a corrupt or missing value falls back to the default
// rather than throwing during store initialisation.

const PREFIX = 'pepper:'

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage unavailable or quota exceeded — preferences are non-critical.
  }
}
