# VoicePath AI: Known Limitations, Boundaries & Honesty Statement

*Version 1.0 · 22 Oct 2026 · Assistive Navigation Prototype*

In accordance with VoicePath AI design guidelines, this document explicitly lists the real-world boundaries, assumptions, and known limitations of the prototype. We believe that assistive technology requires complete honesty rather than inflated claims.

---

## 1. Core Positioning Limitations
1. **Simulated Start Location:** The MVP initializes at `entrance` (or scanned QR checkpoint) and progresses node-by-node when the user taps **Next** or says **"next"**. The app does not feature centimeter-level real-time indoor GPS or UWB tracking.
2. **Pedestrian Dead Reckoning Drift:** Compass readings can experience magnetic drift near metal pillars, lifts, and electrical panels. For this reason, the app grounds guidance on physical landmarks (e.g. *"walk straight until the water cooler"*) rather than exact degree headings or meter measurements.
3. **Pedometer Step Counting:** Step counts are calibrated to an average stride of ~0.7m. Step counts are presented as approximations (*"lagbhag 20 kadam"*), never as absolute guarantees.

---

## 2. Safety Layer & Vision Boundaries
1. **Camera Person Detection is Experimental:** The on-device camera heuristic detects significant close-range human silhouettes (at ~3 frames/second). It does **NOT** detect floor spills, low obstacles, dropped bags, or changes in floor levels.
2. **No Door or Gate State Detection:** The prototype does **NOT** attempt computer-vision classification of whether a door or fire gate is open vs. locked. Door and corridor closures must be maintained in the building map data (`blocked: true`) by authorized staff or reported via the *"Raasta Band Hai"* feedback button.
3. **White Cane / Guide Dog Co-existence:** VoicePath AI is strictly a supplement to primary mobility aids (white canes and guide dogs). It must **never** be used as a standalone obstacle detector.

---

## 3. Platform & Hardware Variances
1. **Haptic Vibration:** `navigator.vibrate` is fully functional on Google Chrome on Android. On iOS Safari, the Web Vibration API is not supported by Apple, so haptic pulses are skipped silently while audio chimes and voice guidance remain fully active.
2. **Web Speech API Browser Support:** Speech recognition operates via the browser's native `SpeechRecognition` API (best supported in Chrome and Edge). To prevent demo failure in noisy environments, quick-select destination buttons and text fallbacks are always visible.
3. **Microphone & Speech Autoplay:** Modern browsers block audio and speech recognition without an explicit user gesture. The large **Start Navigation** button on the home screen serves as this mandatory gesture.

---

---

## 4. Privacy & Data Handling
1. **Zero Image Storage:** Camera frames are evaluated solely in-memory within ephemeral canvas buffers and are never stored, written to `localStorage`, or uploaded to the cloud.
2. **Minimal Guard Dispatch Telemetry:** Calling the security guard transmits only the user label and their last confirmed node location. No biometric or persistent tracking data is gathered.

---

## 5. Supervised Map Building & ARCore Boundaries
1. **ARCore Tracking Loss:** ARCore visual-inertial odometry can lose tracking in plain featureless corridors (white walls without contrast), in poor/dim lighting, and inside lifts where vertical acceleration occurs without visual features.
2. **Cumulative Odometry Drift:** Without physical QR or NFC ground anchors placed every 20–30 meters, pedestrian dead-reckoning drift accumulates, causing waypoint distortion.
3. **OCR and Landmark Label Uncertainty:** OCR and vision models may misidentify room numbers or door types due to glare, angled perspectives, or unusual fonts. All detected landmarks are treated strictly as suggestions requiring admin confirmation.
4. **Android Capacitor WebView Incompatibility:**
   - On a real Android device, standard Android WebView / Capacitor does **NOT** support `navigator.xr` (WebXR Device API) nor reliable `window.BarcodeDetector`.
   - Therefore, a production Android release **must utilize native Android Google ARCore** (via `@capacitor-community/camera` or custom native ARCore bridge) and **Google ML Kit Barcode Scanning** (`@capacitor-mlkit/barcode-scanning`), rather than web browser APIs.
5. **No Stairs / Glass / Wet Floor Vision Claims:** The vision detector cannot reliably identify clear glass doors, descending stairs, wet surfaces, or drop-offs. White canes remain mandatory at all times.

