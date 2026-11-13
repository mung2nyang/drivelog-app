import { assetPath } from '../../shared/utils/assetPath.ts'
import { CarIcon, PeopleIcon, PersonIcon, GearIcon, FuelIcon, ChartIcon, DocIcon, TruckIcon, SupportIcon, AdminIcon } from './side-menu/SideMenuIcons.tsx'
import useSideMenuBackGuard from './useSideMenuBackGuard.ts'
import type { SubLogMenuItem } from './subLogMenuItems.ts'

const BANNER_LIGHT = assetPath('/images/banner_image_Light.png')
const BANNER_DARK = assetPath('/images/banner_image_dark.png')

export function sideMenuBannerSrc() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? BANNER_DARK : BANNER_LIGHT
}

export function preloadSideMenuBanner() {
  const img = document.createElement('img')
  img.src = sideMenuBannerSrc()
  return img
}

type LinkedDriverMenuItem = { linkId: string, driverName: string }

type SideMenuProps = {
  open: boolean
  onClose: () => void
  onSelect: (page: string, title?: string) => void
  linkedDriverItems?: Array<LinkedDriverMenuItem>
  onOpenLinkedDriver?: (linkId: string) => void
  subLogItems?: Array<SubLogMenuItem>
  onOpenSubLog?: (vehicleNumber: string) => void
  isAdmin?: boolean
}

export default function SideMenu({
  open, onClose, onSelect,
  linkedDriverItems = [], onOpenLinkedDriver,
  subLogItems = [], onOpenSubLog,
  isAdmin = false,
}: SideMenuProps) {
  useSideMenuBackGuard(open, onClose)
  if (!open) return null
  const banner = sideMenuBannerSrc()

  function pick(page: string, title?: string) {
    onSelect(page, title)
    onClose()
  }

  function openSubLog(vehicleNumber: string) {
    onOpenSubLog?.(vehicleNumber)
    onClose()
  }

  function openLinkedDriver(linkId: string) {
    onOpenLinkedDriver?.(linkId)
    onClose()
  }

  return (
    <>
      <div className="side-menu-overlay show" onClick={onClose}></div>
      <aside className="side-menu open" aria-label="메뉴">
        <div className="side-menu-header">
          <div className="menu-banner-wrap">
            <img src={banner} alt="운행일지" className="menu-banner" />
          </div>
        </div>
        <div className="side-menu-sections">
          <section className="side-menu-section business-section">
            <h3 className="side-menu-section-title">경영</h3>
            <button type="button" className="dropdown-item" onClick={() => pick('clients')}>
              <PeopleIcon />
              거래처
            </button>
            <button type="button" className="dropdown-item" onClick={() => pick('receivables')}>
              <ChartIcon />
              미수금/정산 관리
            </button>
            <button type="button" className="dropdown-item" onClick={() => pick('report')}>
              <DocIcon />
              서류 발급
            </button>
          </section>
          <section className="side-menu-section management-section">
            <h3 className="side-menu-section-title">관리</h3>
            <button type="button" className="dropdown-item" onClick={() => pick('cars')}>
              <CarIcon />
              차량 관리
            </button>
            <button type="button" className="dropdown-item" onClick={() => pick('expenses')}>
              <FuelIcon />
              차량 유지비
            </button>
            {linkedDriverItems.map((item) => (
              <button
                key={item.linkId}
                type="button"
                className="dropdown-item"
                title={`${item.driverName} 기사 관리`}
                onClick={() => openLinkedDriver(item.linkId)}
              >
                <PeopleIcon />
                {item.driverName} 기사 관리
              </button>
            ))}
            {subLogItems.map((item) => (
              <button
                key={item.number}
                type="button"
                className="dropdown-item"
                title={`${item.driverName || item.label} 기사 관리`}
                onClick={() => openSubLog(item.number)}
              >
                <TruckIcon />
                {item.driverName || item.label} 기사 관리
              </button>
            ))}
          </section>
          <section className="side-menu-section settings-section">
            <h3 className="side-menu-section-title">설정</h3>
            <button type="button" className="dropdown-item" onClick={() => pick('profile')}>
              <PersonIcon />
              개인정보
            </button>
            <button type="button" className="dropdown-item" onClick={() => pick('settings')}>
              <GearIcon />
              앱 설정
            </button>
            <button type="button" className="dropdown-item" onClick={() => pick('support')}>
              <SupportIcon />
              고객센터
            </button>
            {isAdmin && (
              <button type="button" className="dropdown-item" onClick={() => pick('admin')}>
                <AdminIcon />
                관리자
              </button>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
