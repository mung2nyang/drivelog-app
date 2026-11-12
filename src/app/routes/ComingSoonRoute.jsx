import { useNavigate, useSearchParams } from 'react-router-dom'
import { ComingSoonPage } from './lazyPages.js'

export default function ComingSoonRoute() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const backTo = params.get('back') === 'mypage' ? '/app/me' : '/app'

  return <ComingSoonPage title={params.get('title') || ''} onBack={() => navigate(backTo)} />
}
