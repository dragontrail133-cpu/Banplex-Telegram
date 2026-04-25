import { NavLink } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck2,
  FileText,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Users2,
  Wallet,
  X,
} from 'lucide-react'
import useTelegram from '../../hooks/useTelegram'

const navItems = [
  { to: '/', label: 'Beranda', icon: Home, end: true },
  { to: '/transactions', label: 'Transaksi', icon: ReceiptText },
  { to: '/payroll', label: 'Payroll', icon: Users2 },
  { to: '/more', label: 'Menu', icon: MoreHorizontal },
]

const quickActions = [
  {
    label: 'Uang Masuk',
    description: 'Catat termin proyek',
    to: '/edit/project-income/new',
    icon: ArrowUpRight,
  },
  {
    label: 'Uang Keluar',
    description: 'Catat pengeluaran',
    to: '/edit/expense/new',
    icon: ArrowDownRight,
  },
  {
    label: 'Kasbon',
    description: 'Tambah pinjaman',
    to: '/edit/loan/new',
    icon: Wallet,
  },
  {
    label: 'Absensi',
    description: 'Kehadiran harian',
    to: '/attendance/new',
    icon: CalendarCheck2,
  },
  {
    label: 'Faktur',
    description: 'Material invoice',
    to: '/material-invoice/new',
    icon: FileText,
  },
  {
    label: 'Master Data',
    description: 'Kelola data inti',
    to: '/master',
    icon: LayoutGrid,
  },
]

function QuickActionsSheet({ isOpen, onClose, onNavigate }) {
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-3 py-3 sm:items-center">
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 app-backdrop"
            onClick={onClose}
            role="presentation"
          />

          <Motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-[var(--app-outline-soft)] bg-[var(--app-surface-strong-color)] shadow-telegram"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Quick actions"
          >
            <div className="flex w-full justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-[var(--app-outline-soft)]" />
            </div>

            <div className="flex items-center justify-between px-4 pb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Aksi Cepat
                </p>
                <p className="truncate text-xs text-[var(--app-hint-color)]">
                  Pintasan transaksi dan modul utama
                </p>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]"
                onClick={onClose}
                type="button"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 border-t border-[var(--app-outline-soft)] px-4 py-4">
              {quickActions.map((action) => (
                <button
                  key={action.to}
                  className="flex w-full items-center justify-between gap-3 rounded-[24px] bg-[var(--app-surface-low-color)] px-3 py-3 text-left text-sm text-[var(--app-text-color)] transition active:scale-[0.99]"
                  onClick={() => onNavigate(action.to)}
                  type="button"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--app-brand-accent)] text-[var(--app-brand-accent-contrast)] shadow-sm">
                      <action.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {action.label}
                      </span>
                      <span className="block truncate text-xs text-[var(--app-hint-color)]">
                        {action.description}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--app-hint-color)]">
                    Buka
                  </span>
                </button>
              ))}
            </div>
          </Motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

function BottomNav() {
  const { haptic } = useTelegram()
  const navigate = useNavigate()
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false)
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  const navGridItems = useMemo(() => {
    return [
      { kind: 'nav', ...navItems[0] },
      { kind: 'nav', ...navItems[1] },
      { kind: 'fab' },
      { kind: 'nav', ...navItems[2] },
      { kind: 'nav', ...navItems[3] },
    ]
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const isEditableElement = (element) => {
      if (!(element instanceof HTMLElement)) {
        return false
      }

      return (
        element.isContentEditable ||
        element.matches('input, textarea, select, [contenteditable="true"]')
      )
    }

    const updateKeyboardVisibility = () => {
      if (!mobileQuery.matches) {
        setIsKeyboardVisible(false)
        return
      }

      setIsKeyboardVisible(isEditableElement(document.activeElement))
    }

    const handleFocusIn = (event) => {
      if (mobileQuery.matches && isEditableElement(event.target)) {
        setIsKeyboardVisible(true)
      }
    }

    const handleFocusOut = () => {
      window.requestAnimationFrame(updateKeyboardVisibility)
    }

    const handleViewportChange = () => {
      window.requestAnimationFrame(updateKeyboardVisibility)
    }

    updateKeyboardVisibility()

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
    }
  }, [])

  const handleNavigate = (to) => {
    setIsQuickActionsOpen(false)
    navigate(to)
  }

  return (
    <>
      <nav
        aria-hidden={isKeyboardVisible}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-[transform,opacity] duration-200 ease-out ${
          isKeyboardVisible ? 'pointer-events-none translate-y-[calc(100%+1.25rem)] opacity-0' : 'opacity-100'
        }`}
      >
        <div className="relative grid grid-cols-5 items-end gap-1 rounded-[30px] border border-[var(--app-nav-border)] bg-[var(--app-nav-bg)] px-2 pb-2 pt-3 shadow-[var(--app-nav-shadow)]">
          {navGridItems.map((item) => {
            if (item.kind === 'fab') {
              return (
                <div key="fab" className="flex items-center justify-center">
                  <button
                    className="relative -mt-10 inline-flex h-16 w-16 items-center justify-center rounded-[26px] bg-[var(--app-brand-accent)] text-[var(--app-brand-accent-contrast)] shadow-[var(--app-fab-shadow)] transition active:scale-[0.97]"
                    onClick={() => {
                      haptic?.impactOccurred('light')
                      setIsQuickActionsOpen(true)
                    }}
                    type="button"
                    aria-label="Buka aksi cepat"
                  >
                    <Plus className="h-6 w-6" aria-hidden="true" strokeWidth={2.75} />
                  </button>
                </div>
              )
            }

            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => {
                  haptic?.impactOccurred('light')
                }}
                className={({ isActive }) =>
                  `relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[20px] px-1 py-2 text-[10px] font-medium uppercase tracking-[0.14em] transition active:scale-95 ${
                    isActive
                      ? 'bg-[var(--app-nav-active-bg)] text-[var(--app-brand-accent)]'
                      : 'text-[var(--app-hint-color)] hover:text-[var(--app-text-color)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Motion.div
                      animate={{ scale: isActive ? 1.08 : 1 }}
                      transition={{ duration: 0.12, ease: 'easeOut' }}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.9} />
                    </Motion.div>
                    <span className="truncate leading-none">{item.label}</span>
                    <span
                      className={`h-1 w-1 rounded-full transition ${
                        isActive ? 'bg-[var(--app-brand-accent)]' : 'bg-transparent'
                      }`}
                      aria-hidden="true"
                    />
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>

      <QuickActionsSheet
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        onNavigate={handleNavigate}
      />
    </>
  )
}

export default BottomNav
