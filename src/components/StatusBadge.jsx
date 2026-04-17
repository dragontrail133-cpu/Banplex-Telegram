import { AppBadge, AppCard } from './ui/AppPrimitives'

function StatusBadge({ icon, label, value, tone = 'neutral' }) {
  return (
    <AppCard className="flex items-start gap-3">
      <AppBadge tone={tone} icon={icon} className="shrink-0 px-2.5 py-2 text-[11px]">
        {label}
      </AppBadge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-6 text-[var(--app-text-color)]">
          {value}
        </p>
      </div>
    </AppCard>
  )
}

export default StatusBadge
export { StatusBadge }
