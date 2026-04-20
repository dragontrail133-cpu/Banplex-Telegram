import { useEffect, useState } from 'react'
import { Copy, Link2, RefreshCcw, Shield, UserX } from 'lucide-react'
import ActionCard from './ui/ActionCard'
import {
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppWrapToggleGroup,
  PageSection,
} from './ui/AppPrimitives'
import { formatAppDateTime } from '../lib/date-time'
import useAuthStore from '../store/useAuthStore'
import useTeamStore, { inviteRoleOptions } from '../store/useTeamStore'

function formatApprovedAt(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return 'Belum tercatat'
  }

  const parsedDate = new Date(normalizedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  return formatAppDateTime(parsedDate)
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
      await fetchActiveTeam()
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
      await fetchActiveTeam()
    } catch (memberError) {
      console.error('Gagal memperbarui role anggota:', memberError)
    }
  }

  const handleSuspend = async (memberId) => {
    try {
      await suspendTeamMember(memberId)
      await fetchActiveTeam()
    } catch (memberError) {
      console.error('Gagal menangguhkan anggota:', memberError)
    }
  }

  return (
    <div className="space-y-5">
      <PageSection
        eyebrow="Magic Invite Link"
        title="Onboarding tanpa approval manual"
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:max-w-sm">
            <AppWrapToggleGroup
              buttonSize="sm"
              label="Role undangan"
              onChange={setSelectedRole}
              options={inviteRoleOptions.map((role) => ({
                value: role,
                label: role,
              }))}
              value={selectedRole}
            />

            <AppButton
              disabled={isLoading}
              onClick={() => {
                void handleGenerateInvite()
              }}
              leadingIcon={<Link2 className="h-4 w-4" />}
              type="button"
            >
              Buat Link Undangan
            </AppButton>
          </div>

          {latestInvite?.invite_link ? (
            <AppCard className="mt-0 space-y-3 border border-sky-100 bg-sky-50/80">
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
                      Status {latestInvite.lifecycle_status_label}
                    </span>
                    <span className="rounded-full border border-sky-200 bg-white/80 px-3 py-1.5">
                      Berlaku sampai {formatApprovedAt(latestInvite.expires_at)}
                    </span>
                  </div>
                </div>

                <AppButton
                  className="border-sky-200 bg-white text-sky-800"
                  onClick={() => {
                    void handleCopyLink()
                  }}
                  type="button"
                  variant="secondary"
                  leadingIcon={<Copy className="h-4 w-4" />}
                >
                  Copy Link
                </AppButton>
              </div>

              {copyState ? (
                <p className="mt-3 text-sm text-sky-700">{copyState}</p>
              ) : null}
            </AppCard>
          ) : null}

          {error ? (
            <AppCardDashed className="app-tone-danger mt-0 text-sm leading-6 text-rose-700">
              {error}
            </AppCardDashed>
          ) : null}
        </div>
      </PageSection>

      <PageSection
        eyebrow="Active Team"
        title="Anggota aktif di workspace"
        action={
          <AppButton
            disabled={isLoading}
            onClick={() => {
              void fetchActiveTeam().catch((teamError) => {
                console.error('Gagal refresh tim aktif:', teamError)
              })
            }}
            variant="secondary"
            type="button"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </AppButton>
        }
      >
        <div className="space-y-3">
          {activeTeam.length > 0 ? (
            <AppCardStrong padded={false} className="overflow-hidden">
              {activeTeam.map((member) => {
                const isCurrentOwner =
                  member.telegram_user_id &&
                  member.telegram_user_id === authUser?.telegram_user_id &&
                  member.role === 'Owner'

                return (
                  <ActionCard
                    key={member.id}
                    title={`Telegram ID ${member.telegram_user_id || '-'}`}
                    subtitle={`Aktif sejak ${formatApprovedAt(member.approved_at)}`}
                    badge={member.status_label || member.status}
                    badges={[
                      member.is_default ? 'Workspace utama' : '',
                      isCurrentOwner ? 'Owner Bypass' : '',
                    ].filter(Boolean)}
                    details={[
                      `Role saat ini: ${member.role || 'Viewer'}`,
                      `Status anggota: ${member.status_label || member.status || 'Aktif'}`,
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
              })}
            </AppCardStrong>
          ) : (
            <AppCardDashed className="px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
              Belum ada anggota aktif selain akun yang sudah berhasil masuk ke workspace.
            </AppCardDashed>
          )}
        </div>
      </PageSection>
    </div>
  )
}

export default TeamInviteManagerContent
