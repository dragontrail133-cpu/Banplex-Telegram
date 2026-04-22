const formShellRegistry = {
  attendance: {
    title: 'Absensi Harian',
    description: 'Absensi hanya tersedia untuk Owner, Admin, dan Payroll.',
    submitLabel: 'Simpan Sheet Absensi',
    defaultBackRoute: '/payroll',
    loadingPolicy: 'loading-first',
    errorPolicy: 'hard-error',
  },
  materialInvoice: {
    title: 'Faktur Material',
    description: 'Faktur material hanya tersedia untuk Owner, Admin, dan Logistik.',
    submitLabel: 'Simpan Faktur Material',
    defaultBackRoute: '/transactions',
    loadingPolicy: 'loading-first',
    errorPolicy: 'hard-error',
  },
  editRecord: {
    defaultBackRoutes: {
      attendance: '/payroll',
      expense: '/transactions',
      income: '/transactions',
      loan: '/transactions',
      'project-income': '/transactions',
      bill: '/pembayaran',
    },
    loadingPolicy: 'loading-first',
    errorPolicy: 'hard-error',
  },
}

function normalizeRouteCandidate(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function resolveFormBackRoute(kind, { locationState = null, type = null, fallbackRoute = null } = {}) {
  const explicitReturnTo = normalizeRouteCandidate(locationState?.returnTo)

  if (explicitReturnTo) {
    return explicitReturnTo
  }

  const registryEntry = formShellRegistry[kind] ?? null
  const normalizedType = normalizeRouteCandidate(type)?.toLowerCase() ?? ''

  if (kind === 'editRecord') {
    const backRoutes = registryEntry?.defaultBackRoutes ?? {}
    const routeByType = backRoutes[normalizedType] ?? backRoutes.default ?? null

    return normalizeRouteCandidate(routeByType) ?? normalizeRouteCandidate(fallbackRoute)
  }

  if (registryEntry?.defaultBackRoute) {
    return normalizeRouteCandidate(registryEntry.defaultBackRoute)
  }

  return normalizeRouteCandidate(fallbackRoute)
}

function getFormShellPolicy(kind) {
  const registryEntry = formShellRegistry[kind] ?? null

  return {
    loadingPolicy: registryEntry?.loadingPolicy ?? 'loading-first',
    errorPolicy: registryEntry?.errorPolicy ?? 'hard-error',
  }
}

export { formShellRegistry, getFormShellPolicy, resolveFormBackRoute }
