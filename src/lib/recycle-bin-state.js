const recycleBinListStateStorageKey = 'banplex:recycle-bin-list-state'

function canUseSessionStorage(teamId) {
  return Boolean(teamId) && typeof window !== 'undefined'
}

export function readRecycleBinListState(teamId) {
  if (!canUseSessionStorage(teamId)) {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(recycleBinListStateStorageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.teamId !== teamId) {
      return null
    }

    return parsedValue
  } catch (error) {
    console.error('Gagal membaca state Halaman Sampah:', error)
    return null
  }
}

export function saveRecycleBinListState(teamId, state) {
  if (!canUseSessionStorage(teamId)) {
    return
  }

  try {
    window.sessionStorage.setItem(
      recycleBinListStateStorageKey,
      JSON.stringify({
        teamId,
        ...state,
      })
    )
  } catch (error) {
    console.error('Gagal menyimpan state Halaman Sampah:', error)
  }
}

export function markRecycleBinListStateNeedsRefresh(teamId) {
  if (!canUseSessionStorage(teamId)) {
    return
  }

  try {
    const currentState = readRecycleBinListState(teamId)

    if (!currentState) {
      return
    }

    saveRecycleBinListState(teamId, {
      ...currentState,
      needsRefresh: true,
    })
  } catch (error) {
    console.error('Gagal menandai state Halaman Sampah perlu refresh:', error)
  }
}
