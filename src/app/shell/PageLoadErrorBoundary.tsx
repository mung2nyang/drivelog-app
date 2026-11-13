import { Component, type ReactNode } from 'react'
import { reportClientError } from '../errorReport.ts'
import './boot-retry.css'

type BoundaryProps = { resetKey: string, children?: ReactNode }

export default class PageLoadErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  constructor(props: BoundaryProps) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('[PageLoadErrorBoundary] 화면 오류:', error)
    reportClientError({ kind: 'render', message: error?.message, stack: error?.stack })
  }

  componentDidUpdate(prevProps: BoundaryProps) {
    // oxlint-disable-next-line react/no-did-update-set-state
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="boot-retry" role="alert" style={{ position: 'static', minHeight: '60vh' }}>
        <h1>화면을 불러오지 못했습니다.</h1>
        <p>잠시 후 다시 시도해 주세요.</p>
        <button type="button" onClick={() => { window.location.reload() }}>다시 시도</button>
      </div>
    )
  }
}
