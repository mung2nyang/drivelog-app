import type { CapacitorConfig } from '@capacitor/cli'

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
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notice',
      iconColor: '#2b6cb0',
    },
  },
}

export default config
