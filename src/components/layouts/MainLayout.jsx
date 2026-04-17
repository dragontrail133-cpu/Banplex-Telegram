import { Outlet, useLocation } from 'react-router-dom'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav from '../ui/BottomNav'

function MainLayout() {
  const location = useLocation()
  
  return (
    <div className="app-shell mx-auto flex h-screen max-w-md flex-col overflow-hidden md:my-4 md:rounded-[32px] md:border md:border-[var(--app-outline-soft)] md:shadow-[var(--app-card-shadow-strong)]">
      <main className="relative flex-1 overflow-x-hidden overflow-y-auto px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+7.75rem)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: -15, filter: 'blur(2px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: 15, filter: 'blur(2px)' }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}

export default MainLayout
