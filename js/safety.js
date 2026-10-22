/**
 * VoicePath AI: On-Device Camera Safety & Auto-Torch Module
 * Features:
 *  - Automatic Low-Light / Darkness Detection (Frame luminance analysis)
 *  - Automated Hardware Torch/Flashlight Control (Turns ON in dark rooms, OFF when light returns)
 *  - Memory-only frame processing (No storage or unauthorized frame uploads)
 *  - Debounced Close-Person / Central Obstacle Heuristic Detection (3 fps)
 *  - Accessible Spoken Announcements & Haptic Feedback
 */

import { state, update } from "./state.js";
import { speak } from "./voice.js";
import { getTemplate } from "./i18n.js";
import { triggerHaptic } from "./haptics.js";

let mediaStream = null;
let detectionInterval = null;
let lastAlertTime = 0;
const DEBOUNCE_MS = 5000; // max 1 obstacle alert every 5 seconds

// Auto-torch thresholds (0-255 luminance scale)
const DARK_THRESHOLD = 35;        // Below 35 = Dark room / unlit corridor
const LIGHT_RESTORED_THRESHOLD = 70; // Above 70 = Normal room lighting restored
let darkFrameCount = 0;
let lightFrameCount = 0;
let lastTorchAnnouncementTime = 0;
const TORCH_ANNOUNCE_DEBOUNCE_MS = 8000;

/**
 * Starts camera safety monitoring and auto-torch luminance sensor.
 * @param {HTMLVideoElement} videoElement
 * @param {HTMLCanvasElement} [debugCanvas]
 * @returns {Promise<boolean>}
 */
export async function startCameraSafety(videoElement, debugCanvas = null) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera API (getUserMedia) not supported in this browser.");
  }

  stopCameraSafety();

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment", // rear camera
        width: { ideal: 320 },
        height: { ideal: 240 }
      },
      audio: false
    });

    videoElement.srcObject = mediaStream;
    await videoElement.play();

    update({ cameraActive: true });

    // Reset counters
    darkFrameCount = 0;
    lightFrameCount = 0;

    // Detection loop running at ~3 frames per second (350ms)
    detectionInterval = setInterval(() => {
      runDetectionFrame(videoElement, debugCanvas);
    }, 350);

    return true;
  } catch (err) {
    update({ cameraActive: false, torchActive: false, isDarkEnvironment: false });
    console.warn("[SafetyCamera] Failed to initialize camera:", err);
    throw err;
  }
}

/**
 * Controls device hardware torch / flashlight.
 * Uses MediaTrackConstraints torch capability with native plugin fallback.
 * @param {boolean} enable
 * @returns {Promise<boolean>}
 */
export async function setTorch(enable) {
  try {
    const track = mediaStream?.getVideoTracks()?.[0];
    if (track) {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        await track.applyConstraints({
          advanced: [{ torch: Boolean(enable) }]
        });
        update({ torchActive: Boolean(enable) });
        return true;
      }
    }

    // Android Native / Capacitor fallback
    if (typeof window !== "undefined" && window.plugins?.flashlight) {
      if (enable) {
        window.plugins.flashlight.switchOn();
      } else {
        window.plugins.flashlight.switchOff();
      }
      update({ torchActive: Boolean(enable) });
      return true;
    }

    console.info(`[Torch] Torch constraint not supported on this specific sensor.`);
    return false;
  } catch (err) {
    console.warn("[Torch] Could not set torch state:", err);
    return false;
  }
}

/**
 * Toggles torch manually (for voice command or user button).
 */
export async function toggleTorch(forceState = null) {
  const next = forceState !== null ? forceState : !state.torchActive;
  const ok = await setTorch(next);
  if (ok) {
    triggerHaptic("torchToggle");
    const tplKey = next ? "TORCH_AUTO_ON" : "TORCH_AUTO_OFF";
    speak(getTemplate(tplKey, state.language), state.language);
  }
  return ok;
}

/**
 * Stops camera stream, detection loop, and turns off torch.
 */
export function stopCameraSafety() {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }

  // Ensure torch is turned off when camera stops
  if (state.torchActive) {
    setTorch(false).catch(() => {});
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }

  darkFrameCount = 0;
  lightFrameCount = 0;

  update({
    cameraActive: false,
    personDetected: false,
    torchActive: false,
    isDarkEnvironment: false
  });
}

let lastGeminiAnalysisTime = 0;
let isGeminiAnalyzing = false;
let lastAnnouncedObjectText = "";
const GEMINI_ANALYSIS_COOLDOWN_MS = 12000; // 12 seconds cooldown so it doesn't repeatedly talk

async function analyzeWithGeminiVision(canvas) {
  if (isGeminiAnalyzing) return;
  const now = Date.now();
  if (now - lastGeminiAnalysisTime < GEMINI_ANALYSIS_COOLDOWN_MS) return;

  isGeminiAnalyzing = true;
  lastGeminiAnalysisTime = now;

  try {
    const base64Data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
    if (!base64Data) return;

    const res = await fetch("/api/live/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "You are an assistive vision companion for a blind person walking indoors. State in 1 short clear sentence (max 10 words) in Hindi/Hinglish what object or person is directly ahead (e.g., 'Aage darwaza hai', 'Saamne ek vyakti khada hai', 'Saamne rasta saaf hai'). If path is clear, say 'Saamne rasta saaf hai'.",
        imageBase64: base64Data
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.text ? data.text.trim() : "";
      
      // Intelligent duplicate suppression: don't speak if it's identical to last announcement
      if (text && text !== lastAnnouncedObjectText) {
        lastAnnouncedObjectText = text;
        triggerHaptic("alert");
        speak(text, state.language || "hi-IN");
      }
    }
  } catch (err) {
    console.warn("[Safety] Gemini vision analysis error:", err);
  } finally {
    isGeminiAnalyzing = false;
  }
}

/**
 * Analyzes video frame for obstacles AND environment luminance.
 */
function runDetectionFrame(video, canvas) {
  if (!video || video.readyState < 2) return;

  const width = video.videoWidth || 320;
  const height = video.videoHeight || 240;

  // Offscreen canvas for in-memory analysis
  const offscreen = canvas || document.createElement("canvas");
  offscreen.width = 160;
  offscreen.height = 120;
  const ctx = offscreen.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.drawImage(video, 0, 0, 160, 120);

  // -------------------------------------------------------------------------
  // 1. Auto-Torch / Environment Luminance Sensor
  // -------------------------------------------------------------------------
  const fullFrameData = ctx.getImageData(0, 0, 160, 120).data;
  let totalLuminance = 0;
  let totalSamples = 0;

  for (let i = 0; i < fullFrameData.length; i += 32) { // sample every 8th pixel
    const r = fullFrameData[i];
    const g = fullFrameData[i + 1];
    const b = fullFrameData[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    totalLuminance += lum;
    totalSamples++;
  }

  const meanLuminance = totalSamples > 0 ? totalLuminance / totalSamples : 128;
  const now = Date.now();

  // Darkness detected (Sustained for 3 consecutive checks ~1 second)
  if (meanLuminance < DARK_THRESHOLD) {
    darkFrameCount++;
    lightFrameCount = 0;

    if (darkFrameCount >= 3 && !state.torchActive) {
      update({ isDarkEnvironment: true });
      setTorch(true).then((success) => {
        if (success && now - lastTorchAnnouncementTime > TORCH_ANNOUNCE_DEBOUNCE_MS) {
          lastTorchAnnouncementTime = now;
          triggerHaptic("torchToggle");
          speak(getTemplate("TORCH_AUTO_ON", state.language), state.language);
        }
      });
    }
  } else if (meanLuminance > LIGHT_RESTORED_THRESHOLD) {
    // Normal lighting restored (Sustained for 6 consecutive checks ~2 seconds)
    lightFrameCount++;
    darkFrameCount = 0;

    if (lightFrameCount >= 6 && state.torchActive) {
      update({ isDarkEnvironment: false });
      setTorch(false).then((success) => {
        if (success && now - lastTorchAnnouncementTime > TORCH_ANNOUNCE_DEBOUNCE_MS) {
          lastTorchAnnouncementTime = now;
          triggerHaptic("torchToggle");
          speak(getTemplate("TORCH_AUTO_OFF", state.language), state.language);
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // 2. Obstacle / Person Proximity Heuristic Detector
  // -------------------------------------------------------------------------
  const centerData = ctx.getImageData(40, 20, 80, 80).data;
  let highContrastPixels = 0;
  let centerSamples = 0;

  for (let i = 0; i < centerData.length; i += 16) {
    const r = centerData[i];
    const g = centerData[i + 1];
    const b = centerData[i + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance > 40 && luminance < 220) {
      highContrastPixels++;
    }
    centerSamples++;
  }

  const occupancyRatio = centerSamples > 0 ? highContrastPixels / centerSamples : 0;
  const isCloseObject = occupancyRatio > 0.65;

  if (isCloseObject) {
    update({ personDetected: true });
    // Trigger Gemini vision to announce what the object is (calmly, with 12s debounce)
    analyzeWithGeminiVision(offscreen);
  } else {
    update({ personDetected: false });
  }
}
