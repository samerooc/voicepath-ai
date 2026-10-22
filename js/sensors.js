/**
 * VoicePath AI: Sensor Fusion & Device Utilities
 * Compass normalization (iOS vs Android), step detection, and WakeLock screen management.
 */

import { state, update } from "./state.js";

let wakeLockSentinel = null;
let lastAccelMagnitude = 0;
let stepThreshold = 12.0; // peak threshold for pedometer
let lastStepTime = 0;

/**
 * Keeps screen on during navigation to prevent browser sleep and throttled audio.
 */
export async function requestScreenWakeLock() {
  if (typeof window === "undefined" || !("wakeLock" in navigator)) {
    console.info("[Sensors] Screen WakeLock unsupported.");
    return null;
  }

  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
    return wakeLockSentinel;
  } catch (err) {
    console.warn("[Sensors] WakeLock request failed:", err);
    return null;
  }
}

/**
 * Releases the active wake lock.
 */
export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}

/**
 * Initializes compass heading tracking.
 * @param {Function} onHeadingUpdate - (headingDegrees: number) => void
 */
export function startCompass(onHeadingUpdate) {
  function handleOrientation(event) {
    let heading = null;

    // iOS Safari webkitCompassHeading
    if (typeof event.webkitCompassHeading !== "undefined") {
      heading = event.webkitCompassHeading;
    }
    // Android standard alpha
    else if (event.alpha !== null && typeof event.alpha !== "undefined") {
      heading = (360 - event.alpha) % 360;
    }

    if (heading !== null) {
      const rounded = Math.round(heading);
      update({ compassHeading: rounded });
      if (onHeadingUpdate) onHeadingUpdate(rounded);
    }
  }

  // Check if iOS 13+ permission is required
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === "granted") {
          window.addEventListener("deviceorientation", handleOrientation, true);
        }
      })
      .catch(e => console.warn("[Compass] iOS permission denied:", e));
  } else if ("DeviceOrientationEvent" in window) {
    window.addEventListener("deviceorientation", handleOrientation, true);
  }
}

/**
 * Pedometer listener: detects physical walking steps via DeviceMotionEvent.
 */
export function startPedometer(onStep) {
  function handleMotion(e) {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;

    const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const now = Date.now();

    // Peak detection with min 300ms between steps
    if (mag > stepThreshold && lastAccelMagnitude <= stepThreshold && now - lastStepTime > 300) {
      lastStepTime = now;
      const count = state.stepCount + 1;
      update({ stepCount: count });
      if (onStep) onStep(count);
    }
    lastAccelMagnitude = mag;
  }

  if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
    DeviceMotionEvent.requestPermission()
      .then(res => {
        if (res === "granted") {
          window.addEventListener("devicemotion", handleMotion, true);
        }
      })
      .catch(() => {});
  } else if ("DeviceMotionEvent" in window) {
    window.addEventListener("devicemotion", handleMotion, true);
  }
}
