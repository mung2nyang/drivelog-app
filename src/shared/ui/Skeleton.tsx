import PageHeader from './PageHeader.tsx'
import './skeleton.css'

export function SkeletonLines({ lines = 2, label = '불러오는 중' }: { lines?: number, label?: string }) {
  return (
    <div className="skeleton-lines" role="status" aria-busy="true">
      {Array.from({ length: lines }, (_, index) => <span key={index} className="skeleton-bar" aria-hidden="true" />)}
      <span className="skeleton-sr">{label}</span>
    </div>
  )
}

function Bar({ className = '' }: { className?: string }) {
  return <span className={`skeleton-bar ${className}`.trim()} aria-hidden="true" />
}

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index)
}

function MyPageShape() {
  return (
    <>
      <div className="skeleton-card skeleton-profile" aria-hidden="true">
        <Bar className="skeleton-icon" />
        <span className="skeleton-stack"><Bar className="skeleton-w30" /><Bar className="skeleton-w20 skeleton-thin" /></span>
      </div>
      <Bar className="skeleton-heading" />
      <div className="skeleton-shortcuts" aria-hidden="true">
        {range(6).map((index) => (
          <span key={index} className="skeleton-shortcut"><Bar className="skeleton-icon" /><Bar className="skeleton-label" /></span>
        ))}
      </div>
      <div className="skeleton-list" aria-hidden="true">
        {range(3).map((index) => (
          <span key={index} className="skeleton-list-row"><Bar className="skeleton-dot" /><Bar className="skeleton-w30" /></span>
        ))}
      </div>
    </>
  )
}

function RevenueShape() {
  return (
    <>
      <div className="skeleton-card skeleton-revenue-top" aria-hidden="true">
        <Bar className="skeleton-date-nav" />
        <span className="skeleton-row"><Bar className="skeleton-tab" /><Bar className="skeleton-tab" /></span>
        <span className="skeleton-row skeleton-scope-row"><Bar className="skeleton-scope" /><Bar className="skeleton-scope" /><Bar className="skeleton-scope" /></span>
      </div>
      {range(2).map((card) => (
        <div key={card} className="skeleton-card skeleton-summary" aria-hidden="true">
          <Bar className="skeleton-w35" /><Bar className="skeleton-w85" /><Bar className="skeleton-w60" />
        </div>
      ))}
    </>
  )
}

export function PageSkeleton({ path = '', onOpenMenu }: { path?: string, onOpenMenu?: () => void }) {
  const route = path.replace(/\/+$/, '')
  const shape = route === '/app/me' ? 'me' : route === '/app/revenue' ? 'revenue' : 'common'
  return (
    <div className={`page-skeleton${shape === 'common' ? '' : ' is-shaped'}`} data-shape={shape} role="status" aria-busy="true">
      {shape === 'me' && <PageHeader title="마이페이지" onOpenMenu={onOpenMenu} />}
      {shape === 'revenue' && <PageHeader title="매출" onOpenMenu={onOpenMenu} />}
      {shape === 'me' && <MyPageShape />}
      {shape === 'revenue' && <RevenueShape />}
      {shape === 'common' && (
        <>
          <Bar className="skeleton-title" />
          {range(3).map((group) => (
            <div key={group} className="skeleton-card skeleton-group" aria-hidden="true">
              {range(3).map((index) => <span key={index} className="skeleton-bar" />)}
            </div>
          ))}
        </>
      )}
      <span className="skeleton-sr">불러오는 중</span>
    </div>
  )
}
