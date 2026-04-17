import { useEffect, useState } from 'react'
import { Copy, Link2, RefreshCcw, Shield, UserX } from 'lucide-react'
import ProtectedRoute from './ProtectedRoute'
import ActionCard from './ui/ActionCard'
import useAuthStore from '../store/useAuthStore'
import useTeamStore, { inviteRoleOptions } from '../store/useTeamStore'

const approvedAtFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatApprovedAt(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return 'Belum tercatat'
  }

  const parsedDate = new Date(normalizedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  return approvedAtFormatter.format(parsedDate)
}

function TeamInviteManagerContent() {
  const [selectedRole, setSelectedRole] = useState('Viewer')
  const [copyState, setCopyState] = useState('')
  const activeTeam = useTeamStore((state) => state.activeTeam)
  const latestInvite = useTeamStore((state) => state.latestInvite)
  const isLoading = useTeamStore((state) => state.isLoading)
  const error = useTeamStore((state) => state.error)
  const fetchActiveTeam = useTeamStore((state) => state.fetchActiveTeam)
  const generateInviteLink = useTeamStore((state) => state.generateInviteLink)
  const updateTeamMemberRole = useTeamStore((state) => state.updateTeamMemberRole)
  const suspendTeamMember = useTeamStore((state) => state.suspendTeamMember)
  const authUser = useAuthStore((state) => state.user)

  useEffect(() => {
    fetchActiveTeam().catch((teamError) => {
      console.error('Gagal memuat tim aktif:', teamError)
    })
  }, [fetchActiveTeam])

  const handleGenerateInvite = async () => {
    try {
      setCopyState('')
      await generateInviteLink(selectedRole)
    } catch (inviteError) {
      console.error('Gagal membuat invite link:', inviteError)
    }
  }

  const handleCopyLink = async () => {
    if (!latestInvite?.invite_link) {
      return
    }

    try {
      await navigator.clipboard.writeText(latestInvite.invite_link)
      setCopyState('Link berhasil disalin.')
    } catch (copyError) {
      console.error('Gagal menyalin invite link:', copyError)
      setCopyState('Clipboard tidak tersedia di perangkat ini.')
    }
  }

  const handleRoleChange = async (memberId, nextRole) => {
    try {
      await updateTeamMemberRole(memberId, nextRole)
    } catch (memberError) {
      console.error('Gagal memperbarui role anggota:', memberError)
    }
  }

  const handleSuspend = async (memberId) => {
    try {
      await suspendTeamMember(memberId)
    } catch (memberError) {
      console.error('Gagal menangguhkan anggota:', memberError)
    }
  }

  return (
    <ProtectedRoute
      allowedRoles={['Owner']}
      description="Magic Invite Link dan manajemen anggota hanya tersedia untuk Owner."
    >
      <div className="space-y-5">
        <section className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
                Magic Invite Link
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                Onboarding tanpa approval manual
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--app-hint-color)]">
                Buat token sekali pakai berdurasi 24 jam, lalu bagikan deep link
                Telegram Mini App ke anggota baru.
              </p>
            </div>

            <div className="grid w-full gap-3 lg:max-w-sm">
              <label className="grid gap-2 text-sm font-medium text-[var(--app-text-color)]">
                Role undangan
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-[var(--app-text-color)] outline-none transition focus:border-sky-400"
                  onChange={(event) => setSelectedRole(event.target.value)}
                  value={selectedRole}
                >
                  {inviteRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading}
                onClick={() => {
                  void handleGenerateInvite()
                }}
                type="button"
              >
                <Link2 className="h-4 w-4" />
                Buat Link Undangan
              </button>
            </div>
          </div>

          {latestInvite?.invite_link ? (
            <div className="mt-5 rounded-[24px] border border-sky-100 bg-sky-50/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Link terbaru
                  </p>
                  <p className="mt-2 break-all text-sm leading-6 text-sky-950">
                    {latestInvite.invite_link}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-sky-700">
                    <span className="rounded-full border border-sky-200 bg-white/80 px-3 py-1.5">
                      Role {latestInvite.role}
                    </span>
                    <span className="rounded-full border border-sky-200 bg-white/80 px-3 py-1.5">
                      Berlaku sampai {formatApprovedAt(latestInvite.expires_at)}
                    </span>
                  </div>
                </div>

                <button
                  className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-sky-200 bg-white px-4 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
                  onClick={() => {
                    void handleCopyLink()
                  }}
                  type="button"
                >
                  <Copy className="h-4 w-4" />
                  Copy Link
                </button>
              </div>

              {copyState ? (
                <p className="mt-3 text-sm text-sky-700">{copyState}</p>
              ) : null}

              {String(import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim() ? null : (
                <p className="mt-3 text-sm text-amber-700">
                  Set `VITE_TELEGRAM_BOT_USERNAME` agar link tidak memakai placeholder
                  `NamaBotAnda`.
                </p>
              )}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
                Active Team
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                Anggota aktif di workspace
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--app-hint-color)]">
                Owner dapat mengganti role anggota aktif atau langsung men-suspend
                akses mereka.
              </p>
            </div>

            <button
              className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white/85 px-4 py-3 text-sm font-semibold text-[var(--app-text-color)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={() => {
                void fetchActiveTeam().catch((teamError) => {
                  console.error('Gagal refresh tim aktif:', teamError)
                })
              }}
              type="button"
            >
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {activeTeam.length > 0 ? (
              activeTeam.map((member) => {
                const isCurrentOwner =
                  member.telegram_user_id &&
                  member.telegram_user_id === authUser?.telegram_user_id &&
                  member.role === 'Owner'

                return (
                  <ActionCard
                    key={member.id}
                    title={`Telegram ID ${member.telegram_user_id || '-'}`}
                    subtitle={`Aktif sejak ${formatApprovedAt(member.approved_at)}`}
                    badge={member.status}
                    badges={[
                      member.is_default ? 'Workspace utama' : '',
                      isCurrentOwner ? 'Owner Bypass' : '',
                    ].filter(Boolean)}
                    details={[
                      `Role saat ini: ${member.role || 'Viewer'}`,
                      `Telegram: ${member.telegram_user_id || '-'}`,
                    ]}
                    leadingIcon={
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        {member.role === 'Owner' ? (
                          <Shield className="h-5 w-5" />
                        ) : (
                          <span className="text-xs font-semibold">
                            {member.role?.slice(0, 2) ?? 'TM'}
                          </span>
                        )}
                      </span>
                    }
                    actions={[
                      ...inviteRoleOptions
                        .filter((role) => role !== member.role || role === 'Owner')
                        .map((role) => ({
                          id: `role-${role}`,
                          label: role === member.role ? `Aktif: ${role}` : `Set ${role}`,
                          disabled: isLoading || isCurrentOwner || role === member.role,
                          onClick: () => {
                            void handleRoleChange(member.id, role)
                          },
                        })),
                      {
                        id: 'suspend',
                        label: 'Suspend',
                        icon: <UserX className="h-3.5 w-3.5" />,
                        destructive: true,
                        disabled: isLoading || isCurrentOwner,
                        onClick: () => {
                          void handleSuspend(member.id)
                        },
                      },
                    ]}
                  />
                )
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
                Belum ada anggota aktif selain akun yang sudah berhasil masuk ke workspace.
              </div>
            )}
          </div>
        </section>
      </div>
    </ProtectedRoute>
  )
}

export default TeamInviteManagerContent
