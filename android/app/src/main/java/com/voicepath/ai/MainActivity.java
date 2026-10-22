package com.voicepath.ai;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import android.app.Activity;

import java.util.ArrayList;
import java.util.List;

/**
 * Main Android Activity hosting the VoicePath AI accessible web application.
 */
public class MainActivity extends Activity {
    private static final String TAG = "VoicePathMain";
    // =========================================================================
    // BACKEND SERVER URL CONFIGURATION:
    // 1. USB CABLE (Easiest): Run `adb reverse tcp:8000 tcp:8000` -> "http://localhost:8000"
    // 2. SAME WI-FI: Check laptop IP via `ipconfig` -> "http://192.168.X.X:8000"
    // 3. ANDROID EMULATOR: Automatically points to laptop -> "http://10.0.2.2:8000"
    // 4. OFFLINE ASSETS ONLY: "file:///android_asset/www/index.html"
    // =========================================================================
    public static final String BACKEND_SERVER_URL = "http://10.0.2.2:8000";
    public static final String OFFLINE_ASSET_URL = "file:///android_asset/www/index.html";
    private static final int PERMISSION_REQUEST_CODE = 100;

    private WebView mWebView;
    private WebAppInterface mNativeInterface;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen on during navigation if needed
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Initialize Webview directly
        mWebView = new WebView(this);
        setContentView(mWebView);

        setupWebView();
        checkAndRequestPermissions();

        // Try connecting to laptop backend; falls back automatically to local assets on error
        mWebView.loadUrl(BACKEND_SERVER_URL);
    }

    private void setupWebView() {
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Crucial for blind assistive navigation: allows audio and TTS without mandatory user touch
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Cache and performance
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Hardware acceleration
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Register Native Android Bridge
        mNativeInterface = new WebAppInterface(this);
        mWebView.addJavascriptInterface(mNativeInterface, "AndroidNative");

        mWebView.setWebViewClient(new MyWebViewClient());
        mWebView.setWebChromeClient(new MyWebChromeClient(this));
    }

    private static class MyWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            view.loadUrl(url);
            return true;
        }
    }

    private static class MyWebChromeClient extends WebChromeClient {
        private final MainActivity mActivity;

        public MyWebChromeClient(MainActivity activity) {
            mActivity = activity;
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            mActivity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    String[] resources = request.getResources();
                    request.grant(resources);
                    Log.i(TAG, "Granted WebView permissions: " + java.util.Arrays.toString(resources));
                }
            });
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            Log.d(TAG, "[Console] " + consoleMessage.message() + " (" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
            return true;
        }
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> neededPermissions = new ArrayList<>();

            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                neededPermissions.add(Manifest.permission.CAMERA);
            }
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                neededPermissions.add(Manifest.permission.RECORD_AUDIO);
            }

            if (!neededPermissions.isEmpty()) {
                requestPermissions(neededPermissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            for (int i = 0; i < permissions.length; i++) {
                if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                    Toast.makeText(this, "Permission required for voice guidance: " + permissions[i], Toast.LENGTH_SHORT).show();
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (mNativeInterface != null) {
            mNativeInterface.onDestroy();
        }
        if (mWebView != null) {
            mWebView.destroy();
        }
        super.onDestroy();
    }
}
