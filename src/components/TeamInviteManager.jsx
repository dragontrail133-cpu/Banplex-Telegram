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
import { allRoles } from '../lib/rbac'
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

function getInviteStatusChipClassName(status) {
  if (status === 'used') {
    return 'border-[var(--app-tone-neutral-border)] bg-[var(--app-tone-neutral-bg)] text-[var(--app-tone-neutral-text)]'
  }

  if (status === 'expired') {
    return 'border-[var(--app-tone-warning-border)] bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]'
  }

  return 'border-[var(--app-tone-info-border)] bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]'
}

function TeamInviteManagerContent() {
  const [selectedRole, setSelectedRole] = useState(allRoles[allRoles.length - 1])
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
  const activeTeamCount = activeTeam.length
  const activeTeamDescription =
    activeTeamCount > 0
      ? `${activeTeamCount} anggota aktif tersinkron. Ubah role atau suspend langsung dari list.`
      : 'Belum ada anggota aktif di workspace ini.'

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
        title="Buat link undangan"
        description="Pilih role lalu generate link yang aktif 24 jam."
      >
        <AppCardStrong className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="app-meta">Invite control</p>
              <p className="text-sm leading-6 text-[var(--app-hint-color)]">
                Link terbaru akan muncul di kartu bawah dan bisa langsung disalin.
              </p>
            </div>
            <span className="app-chip shrink-0">Aktif 24 jam</span>
          </div>

          <div className="grid gap-3">
            <AppWrapToggleGroup
              buttonSize="sm"
              label="Role undangan"
              description="Role ini dipakai oleh link yang baru dibuat."
              onChange={setSelectedRole}
              options={inviteRoleOptions.map((role) => ({
                value: role,
                label: role,
              }))}
              value={selectedRole}
            />

            <AppButton
              disabled={isLoading}
              fullWidth
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
            <AppCard className="app-tone-info space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="app-meta text-[var(--app-tone-info-text)]">Link terbaru</p>
                    <span className="app-chip">Role {latestInvite.role}</span>
                  </div>
                  <p className="break-all text-sm leading-6 text-[var(--app-tone-info-text)]">
                    {latestInvite.invite_link}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold ${getInviteStatusChipClassName(
                        latestInvite.lifecycle_status
                      )}`}
                    >
                      Status {latestInvite.lifecycle_status_label}
                    </span>
                    <span className="app-chip">
                      Berlaku sampai {formatApprovedAt(latestInvite.expires_at)}
                    </span>
                  </div>
                </div>

                <AppButton
                  className="shrink-0 border-[var(--app-tone-info-border)] bg-white text-[var(--app-tone-info-text)]"
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
                <p className="text-sm leading-6 text-[var(--app-tone-info-text)]">
                  {copyState}
                </p>
              ) : null}
            </AppCard>
          ) : (
            <AppCardDashed className="px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
              Belum ada link undangan aktif. Buat link baru untuk mulai onboarding.
            </AppCardDashed>
          )}

          {error ? (
            <AppCardDashed className="app-tone-danger mt-0 text-sm leading-6">
              {error}
            </AppCardDashed>
          ) : null}
        </AppCardStrong>
      </PageSection>

      <PageSection
        eyebrow="Active Team"
        title="Anggota aktif di workspace"
        description={activeTeamDescription}
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
                  member.role === allRoles[0]

                return (
                  <ActionCard
                    key={member.id}
                    title={`Telegram ID ${member.telegram_user_id || '-'}`}
                    subtitle={`Aktif sejak ${formatApprovedAt(member.approved_at)}`}
                    badge={member.status_label || member.status}
                    badges={[
                      member.is_default ? 'Workspace utama' : '',
                      isCurrentOwner ? 'Owner aktif' : '',
                    ].filter(Boolean)}
                    details={[
                      `Role saat ini: ${member.role || 'Viewer'}`,
                      `Status anggota: ${member.status_label || member.status || 'Aktif'}`,
                      `Telegram: ${member.telegram_user_id || '-'}`,
                    ]}
                    leadingIcon={
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                          isCurrentOwner
                            ? 'bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]'
                            : 'bg-[var(--app-tone-neutral-bg)] text-[var(--app-tone-neutral-text)]'
                        }`}
                      >
                        {member.role === allRoles[0] ? (
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
                        .filter((role) => role !== member.role || role === allRoles[0])
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
              Belum ada anggota aktif di workspace ini.
            </AppCardDashed>
          )}
        </div>
      </PageSection>
    </div>
  )
}

export default TeamInviteManagerContent
