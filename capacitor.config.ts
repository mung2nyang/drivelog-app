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
  plugins: {
    // 앱 안 구글 로그인만 쓴다. 나머지 로그인은 앱에 넣지 않는다.
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
    },
    // 휴대폰 알림창 맨 위 흰색 트럭 아이콘과, 알림 안에서 칠해지는 앱 색.
    LocalNotifications: {
      smallIcon: 'ic_stat_notice',
      iconColor: '#2b6cb0',
    },
  },
}

export default config
