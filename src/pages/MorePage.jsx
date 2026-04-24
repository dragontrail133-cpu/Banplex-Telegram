import { useNavigate } from 'react-router-dom'
import {
  Briefcase,
  ChevronRight,
  FolderKanban,
  HeartHandshake,
  Package,
  Sparkles,
  UserCog,
} from 'lucide-react'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardStrong,
  PageHeader,
  PageShell,
} from '../components/ui/AppPrimitives'

const modules = [
  {
    title: 'HRD & Rekrutmen',
    description: 'Kelola pelamar dan dokumen pendukung.',
    to: '/more/hrd',
    icon: Briefcase,
    toneClass: 'bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]',
    status: 'Dikembangkan',
    statusTone: 'warning',
  },
  {
    title: 'Penerima Manfaat',
    description: 'Data penerima manfaat untuk operasional.',
    to: '/more/beneficiaries',
    icon: HeartHandshake,
    toneClass: 'bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]',
    status: 'Dikembangkan',
    statusTone: 'warning',
  },
  {
    title: 'Tim',
    description: 'Magic invite link dan kontrol role anggota.',
    to: '/more/team-invite',
    icon: UserCog,
    toneClass: 'bg-[var(--app-brand-accent-muted)] text-[var(--app-brand-accent)]',
  },
  {
    title: 'Stok Barang',
    description: 'Pantau stok masuk dan kondisi material.',
    to: '/stock',
    icon: Package,
    toneClass: 'bg-[var(--app-tone-success-bg)] text-[var(--app-tone-success-text)]',
  },
  {
    title: 'Unit Kerja',
    description: null,
    to: '/reports',
    icon: FolderKanban,
    toneClass: 'bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]',
  },
]

function MorePage() {
  const navigate = useNavigate()

  return (
    <PageShell>
      <PageHeader
        eyebrow="Aksi Cepat"
        title="More"
      />

      <AppCardStrong className="space-y-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <AppBadge tone="info" icon={Sparkles}>
              Operational Hub
            </AppBadge>
          </div>
        </div>

        <div className="space-y-3">
          {modules.map((module) => {
            const Icon = module.icon

            return (
              <AppCard key={module.to} className="bg-[var(--app-surface-strong-color)] p-1">
                <AppButton
                  className="min-h-24 w-full items-center justify-between rounded-[24px] px-4 py-4 text-left"
                  leadingIcon={
                    <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${module.toneClass}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  }
                  onClick={() => navigate(module.to)}
                  trailingIcon={<ChevronRight className="h-4 w-4" />}
                  type="button"
                  variant="ghost"
                >
                  <span className="block min-w-0 text-left">
                    <span className="block text-sm font-semibold text-[var(--app-text-color)]">
                      {module.title}
                    </span>
                    {module.description ? (
                      <span className="block text-xs font-normal text-[var(--app-hint-color)]">
                        {module.description}
                      </span>
                    ) : null}
                    {module.status ? (
                      <AppBadge className="mt-2 w-fit" tone={module.statusTone ?? 'neutral'}>
                        {module.status}
                      </AppBadge>
                    ) : null}
                  </span>
                </AppButton>
              </AppCard>
            )
          })}
        </div>
      </AppCardStrong>
    </PageShell>
  )
}

export default MorePage
