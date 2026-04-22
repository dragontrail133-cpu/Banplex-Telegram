import { lazy, Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

const LOADER_SOURCE_URLS = {
  global: 'https://lottie.host/7807f519-28a8-4bf3-aa05-56db9400bf2c/4IZudj4o21.lottie',
  form: 'https://lottie.host/24676bf6-358f-4489-850c-5ecbc3c18c01/wExGyKLlK3.lottie',
  server: 'https://lottie.host/3af976be-28b8-4876-9118-472b4fb58a62/xsoiAlPVqQ.lottie',
}

const LazyDotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((module) => ({
    default: module.DotLottieReact,
  }))
)

const loaderAssetPromises = new Map()

function getLoaderSourceUrl(context) {
  return LOADER_SOURCE_URLS[context] ?? LOADER_SOURCE_URLS.global
}

async function loadLoaderAsset(context = 'global') {
  const normalizedContext = LOADER_SOURCE_URLS[context] ? context : 'global'

  if (!loaderAssetPromises.has(normalizedContext)) {
    loaderAssetPromises.set(
      normalizedContext,
      fetch(getLoaderSourceUrl(normalizedContext)).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Loader asset failed with status ${response.status}`)
      }

      return response.arrayBuffer()
    })
    )
  }

  return loaderAssetPromises.get(normalizedContext)
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updatePreference()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference)
      return () => mediaQuery.removeEventListener('change', updatePreference)
    }

    mediaQuery.addListener(updatePreference)
    return () => mediaQuery.removeListener(updatePreference)
  }, [])

  return prefersReducedMotion
}

function useLoaderAsset(context, shouldLoadAsset) {
  const [state, setState] = useState(() => ({
    status: shouldLoadAsset ? 'loading' : 'idle',
    data: null,
  }))

  useEffect(() => {
    if (!shouldLoadAsset) {
      return undefined
    }

    let isActive = true

    loadLoaderAsset(context)
      .then((data) => {
        if (isActive) {
          setState({ status: 'ready', data })
        }
      })
      .catch(() => {
        if (isActive) {
          setState({ status: 'error', data: null })
        }
      })

    return () => {
      isActive = false
    }
  }, [context, shouldLoadAsset])

  return state
}

function LoaderFallback({ size }) {
  return (
    <div className="grid place-items-center">
      <Loader2
        className={`animate-spin text-[var(--app-brand-accent)] ${
          size === 'hero' ? 'h-7 w-7' : 'h-5 w-5'
        }`}
      />
    </div>
  )
}

function BrandLoaderContent({ size = 'hero', context = 'global', className = '' }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const loaderState = useLoaderAsset(context, !prefersReducedMotion)
  const frameSizeClassName =
    size === 'hero' ? 'h-28 w-28 rounded-[28px]' : 'h-16 w-16 rounded-[22px]'

  return (
    <div
      className={`relative grid place-items-center ${frameSizeClassName} ${className}`}
      aria-hidden="true"
    >
      <div className="flex h-full w-full items-center justify-center">
        {prefersReducedMotion || loaderState.status !== 'ready' || !loaderState.data ? (
          <LoaderFallback size={size} />
        ) : (
          <Suspense fallback={<LoaderFallback size={size} />}>
            <LazyDotLottieReact
              data={loaderState.data}
              autoplay
              loop
              speed={0.92}
              useFrameInterpolation={false}
              className="h-full w-full"
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function BrandLoader({ size = 'hero', context = 'global', className = '' }) {
  const loaderKey = `${context}:${size}`

  return <BrandLoaderContent key={loaderKey} size={size} context={context} className={className} />
}

export default BrandLoader
