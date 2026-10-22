package com.voicepath.ai;

import android.content.Context;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.view.accessibility.AccessibilityManager;
import android.webkit.JavascriptInterface;

import java.util.Locale;

/**
 * JavaScript interface exposed to the WebView as "AndroidNative".
 * Provides direct access to Android TTS, Haptics, Torch, and TalkBack detection.
 */
public class WebAppInterface implements TextToSpeech.OnInitListener {
    private static final String TAG = "VoicePathNative";
    private final Context mContext;
    private TextToSpeech mTts;
    private boolean mTtsReady = false;
    private final Vibrator mVibrator;
    private final CameraManager mCameraManager;
    private String mCameraId = null;

    public WebAppInterface(Context context) {
        mContext = context.getApplicationContext();
        mTts = new TextToSpeech(mContext, this);
        mVibrator = (Vibrator) mContext.getSystemService(Context.VIBRATOR_SERVICE);
        mCameraManager = (CameraManager) mContext.getSystemService(Context.CAMERA_SERVICE);

        try {
            if (mCameraManager != null) {
                for (String id : mCameraManager.getCameraIdList()) {
                    CameraCharacteristics characteristics = mCameraManager.getCameraCharacteristics(id);
                    Boolean hasFlash = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                    Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
                    if (Boolean.TRUE.equals(hasFlash) && facing != null && facing == CameraCharacteristics.LENS_FACING_BACK) {
                        mCameraId = id;
                        break;
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to initialize camera flash: " + e.getMessage());
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            mTtsReady = true;
            mTts.setSpeechRate(1.0f);
            Log.i(TAG, "Native Android TextToSpeech initialized successfully.");
        } else {
            Log.e(TAG, "Failed to initialize native Android TextToSpeech (status: " + status + ")");
        }
    }

    @JavascriptInterface
    public void speak(String text, String lang) {
        if (!mTtsReady || text == null || text.trim().isEmpty()) return;

        Locale targetLocale = "hi-IN".equalsIgnoreCase(lang) || "hi".equalsIgnoreCase(lang)
                ? new Locale("hi", "IN")
                : new Locale("en", "IN");

        int result = mTts.setLanguage(targetLocale);
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            Log.w(TAG, "Voice pack for " + lang + " not available on device. Falling back to English.");
            mTts.setLanguage(Locale.US);
        }

        mTts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "VOICEPATH_UTTERANCE_" + System.currentTimeMillis());
    }

    @JavascriptInterface
    public void stopSpeech() {
        if (mTtsReady && mTts != null) {
            mTts.stop();
        }
    }

    @JavascriptInterface
    public void vibrate(long milliseconds) {
        if (mVibrator == null || !mVibrator.hasVibrator()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mVibrator.vibrate(VibrationEffect.createOneShot(milliseconds, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            mVibrator.vibrate(milliseconds);
        }
    }

    @JavascriptInterface
    public void setTorch(boolean enabled) {
        if (mCameraManager == null || mCameraId == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                mCameraManager.setTorchMode(mCameraId, enabled);
            }
        } catch (CameraAccessException e) {
            Log.w(TAG, "Failed to toggle torch: " + e.getMessage());
        }
    }

    @JavascriptInterface
    public boolean isTalkBackActive() {
        AccessibilityManager am = (AccessibilityManager) mContext.getSystemService(Context.ACCESSIBILITY_SERVICE);
        return am != null && am.isEnabled() && am.isTouchExplorationEnabled();
    }

    @JavascriptInterface
    public void log(String message) {
        Log.i(TAG, "[WebView] " + message);
    }

    public void onDestroy() {
        if (mTts != null) {
            mTts.stop();
            mTts.shutdown();
        }
    }
}
