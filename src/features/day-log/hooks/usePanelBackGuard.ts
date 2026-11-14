import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { panelGuardOnTop, popPanelGuardThen, takeGuardSkip } from '../../../shared/utils/historyMoves.ts'
import { cancelConfirmDialog, confirmDialogOpen } from '../../../shared/ui/confirmDialog.tsx'

export default function usePanelBackGuard(open: boolean, confirmLeave: () => Promise<boolean>, leave: () => void) {
  const location = useLocation()
  const navigate = useNavigate()
  const pushedRef = useRef(false)
  const latest = useRef({ confirmLeave, leave, location })
  latest.current = { confirmLeave, leave, location }

  function pushGuard() {
    const { pathname, search, state } = latest.current.location
    takeGuardSkip()
    pushedRef.current = true
    navigate({ pathname, search }, { state: { ...(state && typeof state === 'object' ? state : {}), panelGuard: true } })
  }

  useEffect(() => {
    if (open && !pushedRef.current) pushGuard()
    if (!open && pushedRef.current) popPanelGuardThen(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!pushedRef.current || panelGuardOnTop()) return
    pushedRef.current = false
    if (takeGuardSkip()) return
    pushGuard()
    if (confirmDialogOpen()) { cancelConfirmDialog(); return }
    void latest.current.confirmLeave().then((ok) => {
      if (ok) popPanelGuardThen(() => latest.current.leave())
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  useEffect(() => () => { takeGuardSkip() }, [])
}
