# VoicePath AI – Android Studio Project

This directory contains the production-ready native Android Studio project for **VoicePath AI (Saathi)**.

## Project Structure
- **Package Name:** `com.voicepath.ai`
- **Target SDK:** 34 (Android 14)
- **Min SDK:** 24 (Android 7.0 Nougat - covers 98%+ active Android devices)
- **Core Activity:** `MainActivity.java` (hosts WebView with hardware acceleration, camera permission management, and lifecycle controls)
- **Native Bridge:** `WebAppInterface.java` (connects JavaScript to Android native system services)
- **Assets Bundle:** `app/src/main/assets/www/` (complete offline self-contained web bundle)

## How to Build in Android Studio
1. Open **Android Studio**.
2. Click **File** > **Open...** and select the `android` folder:
   `d:\Downloads\vp modle\android`
3. Wait for Gradle Sync to complete.
4. To build the debug APK:
   Click **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   The resulting `.apk` will be in:
   `app/build/outputs/apk/debug/app-debug.apk`
5. Connect your Android phone via USB (with USB Debugging enabled) and click **Run (Shift + F10)**.

## Native Features Integrated
1. **System TextToSpeech:** Uses Android's native `android.speech.tts.TextToSpeech` engine, eliminating Web Speech API Chrome cutoff bugs and supporting offline `hi-IN` and `en-IN` voice packs.
2. **Native Haptic Pulses:** Direct access to `Vibrator` and `VibrationEffect` for tactile direction alerts without depending on browser vibration permissions.
3. **Hardware Torch/Flashlight:** Camera flash control via `CameraManager.setTorchMode` for automatic illumination in dark hallways.
4. **TalkBack Awareness:** Detects whether Google TalkBack is actively running via `AccessibilityManager.isTouchExplorationEnabled()`.
5. **Auto-Granted Web Permissions:** `WebChromeClient.onPermissionRequest` automatically grants camera and microphone access to the internal `file:///android_asset/` bundle without continuous browser popups.
