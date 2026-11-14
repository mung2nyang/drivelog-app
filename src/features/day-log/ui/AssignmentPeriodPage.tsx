import PageHeader from '../../../shared/ui/PageHeader.tsx'

type AssignmentPeriodPageProps = { title: string, notice: { title: string, body: string }, onBack?: () => void, onOpenMenu?: () => void }

export default function AssignmentPeriodPage({ title, notice, onBack, onOpenMenu }: AssignmentPeriodPageProps) {
  return (
    <div className="page work-log-page">
      <PageHeader title={title} onBack={onBack} onOpenMenu={onOpenMenu} />
      <div className="empty-state assignment-period-notice" role="status">
        <p>{notice.title}</p>
        <p>{notice.body}</p>
      </div>
    </div>
  )
}
