import { ArrowLeft } from 'lucide-react'
import { AppButton } from '../ui/AppPrimitives'

function FormHeader({
  title,
  onBack,
  className = '',
  rightSlot = null,
  backLabel = 'Kembali',
}) {
  return (
    <header
      className={[
        'flex shrink-0 items-center bg-[var(--app-surface-strong-color)] px-4 py-3.5 shadow-[0_1px_0_var(--app-outline-soft)] backdrop-blur-xl',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AppButton
        iconOnly
        className="shrink-0 rounded-full"
        onClick={onBack}
        type="button"
        variant="secondary"
        aria-label={backLabel}
      >
        <ArrowLeft className="h-4 w-4" />
      </AppButton>

      <h1 className="min-w-0 flex-1 px-2 text-center text-base font-semibold text-[var(--app-text-color)]">
        {title}
      </h1>

      {rightSlot ?? <div className="h-11 w-11 shrink-0" aria-hidden="true" />}
    </header>
  )
}

export default FormHeader
