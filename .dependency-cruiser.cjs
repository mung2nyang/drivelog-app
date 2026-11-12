const ALLOWED_CROSS_FEATURE = [
  ['src/features/day-log/ui/CallClientQuickAdd.jsx', 'src/features/clients/ui/ClientFormModal.jsx'],
  ['src/features/day-log/ui/DayLogExpenses.jsx', 'src/features/expenses/ui/ExpenseFormModal.jsx'],
  ['src/features/home/ui/HomePage.jsx', 'src/features/receivables/hooks/useReceivablesData.js'],
  ['src/features/drivers/ui/LinkedDriverClientsPage.jsx', 'src/features/clients/ui/ScopedClientsList.jsx'],
  ['src/features/account/ui/PersonalInfoPage.jsx', 'src/features/drivers/ui/EmployerLinkCard.jsx'],
  ['src/features/cars/ui/CarDriverConnectPanel.jsx', 'src/features/drivers/ui/driver-connection.css'],
  ['src/features/clients/ui/ScopedClientsList.jsx', 'src/features/drivers/ui/linked-driver.css'],
  ['src/features/drivers/ui/LinkedDriverClientsPage.jsx', 'src/features/clients/ui/client-management.css'],
]

const exact = (/** @type {string} */ path) => `^${path.replace(/[.]/g, '\\.')}$`
const featureOf = (/** @type {string} */ path) => path.split('/').slice(0, 3).join('/') + '/'
const exceptionSources = [...new Set(ALLOWED_CROSS_FEATURE.map(([from]) => from))]

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-only-domain',
      comment: 'domain(계산)은 domain만 부른다.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(shared|data|features|app)/' },
    },
    {
      name: 'shared-below-data',
      comment: 'shared(공용 부품)는 shared와 domain만 부른다.',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(data|features|app)/' },
    },
    {
      name: 'data-below-features',
      comment: 'data(저장)는 data와 shared와 domain만 부른다.',
      severity: 'error',
      from: { path: '^src/data/' },
      to: { path: '^src/(features|app)/' },
    },
    {
      name: 'features-below-app',
      comment: 'features(기능 화면)는 app(앱 틀)을 부르지 않는다.',
      severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-cross-feature',
      comment: '기능은 다른 기능을 부르지 않는다(허용 예외 목록은 맨 위).',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/', pathNot: exceptionSources.map(exact) },
      to: { path: '^src/features/', pathNot: '^src/features/$1/' },
    },
    ...exceptionSources.map((source) => ({
      name: 'no-cross-feature',
      comment: '허용 예외 파일도 목록에 적힌 곳 말고는 다른 기능을 부르지 않는다.',
      severity: /** @type {const} */ ('error'),
      from: { path: exact(source) },
      to: {
        path: '^src/features/',
        pathNot: [`^${featureOf(source)}`, ...ALLOWED_CROSS_FEATURE.filter(([from]) => from === source).map(([, to]) => exact(to))],
      },
    })),
  ],
  options: {
    exclude: { path: ['\\.test\\.js$', '^src/testSupport/'] },
    doNotFollow: { path: 'node_modules' },
    parser: 'swc',
  },
}
