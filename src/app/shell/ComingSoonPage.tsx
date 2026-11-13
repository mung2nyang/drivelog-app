import PageHeader from '../../shared/ui/PageHeader.tsx'

export default function ComingSoonPage({ title, onBack }: { title: string, onBack: () => void }) {
  return (
    <div className="page coming-soon-page">
      <PageHeader title={title} onBack={onBack} />
      <p className="empty-state">준비 중인 화면입니다.</p>
    </div>
  )
}
