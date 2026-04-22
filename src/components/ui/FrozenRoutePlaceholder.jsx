import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BrandLoader from './BrandLoader'
import { AppButton, AppViewportSafeArea } from './AppPrimitives'

function FrozenRoutePlaceholder({
  description,
  backTo = '/more',
  backLabel = 'Kembali',
}) {
  const navigate = useNavigate()

  return (
    <AppViewportSafeArea as="main" className="min-h-screen sm:mx-auto sm:max-w-md">
      <section className="grid min-h-[calc(100dvh-1rem)] place-items-center px-4 text-center">
        <div className="flex flex-col items-center gap-5">
          <BrandLoader context="server" size="hero" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
              Fitur sedang dikembangkan
            </h1>
            <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
              {description}
            </p>
          </div>
          <AppButton
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(backTo)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {backLabel}
          </AppButton>
        </div>
      </section>
    </AppViewportSafeArea>
  )
}

export default FrozenRoutePlaceholder
