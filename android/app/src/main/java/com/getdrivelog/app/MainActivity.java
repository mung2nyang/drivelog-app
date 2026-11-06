package com.getdrivelog.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String LAST_URL_KEY = "drivelogLastUrl";

    // 다른 앱에 가 있는 동안 앱이 정리돼도 돌아오면 보던 화면 주소로 다시 연다(우리 사이트 /app 화면만).
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null || bridge == null) return;
        String lastUrl = savedInstanceState.getString(LAST_URL_KEY);
        String appUrl = bridge.getAppUrl();
        if (lastUrl == null || appUrl == null) return;
        String appHome = appUrl.replaceAll("/+$", "") + "/app";
        if (lastUrl.equals(appHome) || lastUrl.startsWith(appHome + "/") || lastUrl.startsWith(appHome + "?")) {
            bridge.getWebView().loadUrl(lastUrl);
        }
    }

    @Override
    public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        WebView webView = bridge == null ? null : bridge.getWebView();
        String url = webView == null ? null : webView.getUrl();
        if (url != null) outState.putString(LAST_URL_KEY, url);
    }
}
