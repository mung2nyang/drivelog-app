package com.getdrivelog.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebView;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    private static final String LAST_URL_KEY = "drivelogLastUrl";
    private static final String COARSE_LOCATION = Manifest.permission.ACCESS_COARSE_LOCATION;

    private String pendingGeoOrigin;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private final ActivityResultLauncher<String> coarseLocationLauncher = registerForActivityResult(
        new ActivityResultContracts.RequestPermission(),
        (granted) -> answerGeo(granted)
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
        useCoarseLocationOnly();
        restoreLastUrl(savedInstanceState);
    }

    // 앱 화면이 위치를 물으면 대략 위치만 요청한다(정확한 위치는 쓰지 않음, 안드로이드 11 이하도 같게).
    private void useCoarseLocationOnly() {
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (ContextCompat.checkSelfPermission(MainActivity.this, COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                    return;
                }
                answerGeo(false);
                pendingGeoOrigin = origin;
                pendingGeoCallback = callback;
                coarseLocationLauncher.launch(COARSE_LOCATION);
            }
        });
    }

    private void answerGeo(boolean granted) {
        if (pendingGeoCallback != null) pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
        pendingGeoCallback = null;
        pendingGeoOrigin = null;
    }

    // 다른 앱에 가 있는 동안 앱이 정리돼도 돌아오면 보던 화면 주소로 다시 연다(우리 사이트 /app 화면만).
    private void restoreLastUrl(Bundle savedInstanceState) {
        if (savedInstanceState == null) return;
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
