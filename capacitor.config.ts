import type { CapacitorConfig } from '@capacitor/cli'

// 앱은 배포된 사이트를 불러온다. 사이트 배포만으로 앱 화면도 바뀐다.
const config: CapacitorConfig = {
  appId: 'com.getdrivelog.app',
  appName: '운행일지',
  webDir: 'dist',
  server: {
    url: 'https://getdrivelog.com',
    cleartext: false,
  },
  android: {
    backgroundColor: '#121212',
  },
}

export default config
