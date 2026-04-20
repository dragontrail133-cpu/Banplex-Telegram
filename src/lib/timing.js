export function nowMs() {
  const perf = globalThis.performance

  if (perf && typeof perf.now === 'function') {
    return perf.now()
  }

  return Date.now()
}

export function roundMs(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return 0
  }

  return Math.round(numericValue * 100) / 100
}

export function logPerf(label, payload = {}, enabled = false) {
  if (!enabled) {
    return
  }

  console.info(`[perf] ${label}`, payload)
}
