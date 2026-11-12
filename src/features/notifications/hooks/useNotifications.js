// @ts-check
import { useMemo, useSyncExternalStore } from 'react'
import { collectNotifications } from '../api/notifications.js'
import { buildInquiryNoticeItems } from '../api/inquiryNoticeItems.ts'
import { readDismissedIds } from '../api/dismissNotice.ts'
import useInquiryNotices from './useInquiryNotices.ts'
import { getState, subscribe } from '../../../data/store/app-store.ts'
import { failedDayLogDatesVersion, subscribeFailedDayLogDates } from '../../../data/sync/failedDayLogDates.ts'
import {
  useOwnerClients,
  useOwnerDrivers,
  useOwnerProfile,
  useOwnerSettings,
  useOwnerWorkDataByLogId,
} from '../../../data/store/ownerDataHooks.ts'

/**
 * @param {string} ownerKey
 * @param {import('../../../data/sync/syncTypes.ts').AppSession|null} [session]
 * @param {string} [refreshKey]
 */
export default function useNotifications(ownerKey, session = null, refreshKey = '') {
  const workDataByLogId = useOwnerWorkDataByLogId(ownerKey)
  const settings = useOwnerSettings(ownerKey)
  const drivers = useOwnerDrivers(ownerKey)
  const clients = useOwnerClients(ownerKey)
  const profile = useOwnerProfile(ownerKey)
  const dismissed = useSyncExternalStore(subscribe, () => getState().dismissedNotifications[ownerKey])
  const failedVersion = useSyncExternalStore(subscribeFailedDayLogDates, failedDayLogDatesVersion)
  const inquiry = useInquiryNotices(refreshKey)
  return useMemo(
    () => [
      ...collectNotifications(ownerKey, session),
      ...buildInquiryNoticeItems(inquiry, readDismissedIds(ownerKey), settings.notifOff || []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ownerKey, session, refreshKey, workDataByLogId, settings, drivers, clients, profile, dismissed, inquiry, failedVersion],
  )
}
