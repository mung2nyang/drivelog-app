import usePullToRefresh, { PULL_TRIGGER } from './usePullToRefresh.ts'
import './pull-refresh.css'

export default function PullRefreshIndicator() {
  const { distance, dragging, refreshing } = usePullToRefresh()
  const ready = distance >= PULL_TRIGGER
  const className = `pull-refresh${dragging ? ' is-dragging' : ''}${ready ? ' is-ready' : ''}${refreshing ? ' is-refreshing' : ''}`
  return (
    <div className={className} style={{ transform: `translateY(${distance}px)` }} aria-hidden="true">
      <svg viewBox="0 0 24 24" style={{ transform: `rotate(${Math.round(distance * 4)}deg)` }}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
        <polyline points="21 3 21 9 15 9"></polyline>
      </svg>
    </div>
  )
}
