import { Bot, Database, Send, ShieldCheck } from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { PageHeader } from '../components/ui/AppPrimitives'

function getDisplayName(user) {
  return user?.first_name || user?.username || 'Banplex Builder'
}

function getUserMeta(user) {
  if (user?.username) {
    return `@${user.username}`
  }

  if (user?.id) {
    return `Telegram ID ${user.id}`
  }

  return 'Buka aplikasi ini dari Telegram untuk membaca profil pengguna.'
}

function HomePage({ user, hasMainButton, isSupabaseConfigured }) {
  const displayName = getDisplayName(user)
  const userMeta = getUserMeta(user)

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-8rem] h-64 w-64 rounded-full bg-[var(--app-brand-accent-soft)]" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-72 w-72 rounded-full bg-[var(--app-tone-info-bg)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <section className="w-full max-w-4xl space-y-6 px-1">
          <PageHeader
            eyebrow={
              <span className="inline-flex items-center gap-2">
                <Bot className="h-4 w-4 text-[var(--app-brand-accent)]" strokeWidth={2.25} />
                Telegram Mini App
              </span>
            }
            title={`Halo, ${displayName}`}
            description={userMeta}
            chips={[
              <span key="webapp" className="app-chip">
                WebApp {user ? 'terhubung' : 'mode browser biasa'}
              </span>,
            ]}
          />

          <aside className="grid gap-3 sm:grid-cols-3">
            <StatusBadge
              icon={Send}
              label="Main Button"
              tone={hasMainButton ? 'success' : 'warning'}
              value={
                hasMainButton
                  ? 'SDK Telegram mendeteksi MainButton.'
                  : 'Belum tersedia di browser non-Telegram.'
              }
            />
            <StatusBadge
              icon={Database}
              label="Supabase"
              tone={isSupabaseConfigured ? 'success' : 'info'}
              value={
                isSupabaseConfigured
                  ? 'Client siap dipakai lewat env VITE_SUPABASE_*.'
                  : 'Tambahkan env Supabase untuk mulai query data.'
              }
            />
            <StatusBadge
              icon={ShieldCheck}
              label="Fondasi"
              tone="neutral"
              value="Router, store, hook, dan struktur folder enterprise sudah tersusun."
            />
          </aside>
        </section>
      </div>
    </main>
  )
}

export default HomePage
export { HomePage }
