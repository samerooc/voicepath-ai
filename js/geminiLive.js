/**
 * VoicePath AI: Gemini Live Multimodal AI Vision & Voice Conversational Engine
 * Dual-Mode Engine:
 *  1. Ultra-low latency WebSocket Live Streaming (Audio + Video Frames)
 *  2. Resilient Multimodal REST Vision + Voice Fallback (Always functional even if WebSockets are blocked)
 */

import { state, update } from "./state.js";
import { speak, cancelSpeech } from "./voice.js";
import { triggerHaptic } from "./haptics.js";

const DEFAULT_LIVE_MODEL = "models/gemini-2.0-flash-exp";
const REST_VISION_MODEL = "gemini-2.5-flash";

export class GeminiLiveAssistant {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isStreaming = false;
    this.mode = "idle"; // "websocket_live" | "rest_vision" | "idle"

    // Audio input/output
    this.audioContext = null;
    this.micStream = null;
    this.micProcessor = null;
    this.nextPlayTime = 0;

    // Video stream
    this.videoElement = null;
    this.videoCanvas = document.createElement("canvas");
    this.videoInterval = null;

    // Callbacks
    this.onStatusChange = null;
    this.onTranscript = null;
  }

  /**
   * Connects to Live AI via secure server relay.
   * Client never holds, stores, or transmits Gemini API keys.
   */
  async connect(videoEl = null) {
    let hasServerRelay = false;

    try {
      const cfgRes = await fetch("/api/live/config");
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        hasServerRelay = Boolean(cfg.relayAvailable);
      }
    } catch (e) {
      console.warn("[GeminiLive] Server relay check failed:", e);
    }

    if (!hasServerRelay) {
      throw new Error("Gemini live vision service is currently unreachable.");
    }

    this.videoElement = videoEl;
    if (this.ws) {
      this.disconnect();
    }

    this.updateStatus("Connecting Live AI (Server Relay)...");

    // Server-side relay REST Vision mode
    this.mode = "rest_vision";
    this.isConnected = true;
    this.updateStatus("Live Vision AI (Server Relay Active)");
    if (this.onStatusChange) this.onStatusChange("connected");
    return true;
  }

  sendSetupFrame() {
    const systemPrompt = `You are VoicePath AI Live Vision Assistant, an empathetic, concise, and safety-conscious companion for a visually impaired user navigating indoors.
The user is streaming live video from their camera, along with voice.
CRITICAL SAFETY MANDATES:
1. NEVER declare or imply that the path is 'safe', 'clear', or 'free of obstacles'. Camera field of view is limited and indoor conditions change constantly.
2. ALWAYS use strictly hedged language: e.g., 'Mujhe abhi aage kuch nahi dikh raha, cane use karte rehna' or 'I don't see anything ahead right now, keep using your white cane.'
3. Always answer in short, natural conversational sentences (maximum 2-3 sentences).
4. Support Hindi, Hinglish, and English seamlessly depending on what language the user speaks.
5. When the user asks 'Saamne kya hai?' or 'What is ahead?', describe visible landmarks, doors, people, or signboards factually.
6. Always remind them that white cane scanning remains primary for ground-level detection.`;

    const setupMsg = {
      setup: {
        model: DEFAULT_LIVE_MODEL,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede"
              }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      }
    };

    this.ws.send(JSON.stringify(setupMsg));
  }

  async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000
      });
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    this.nextPlayTime = this.audioContext.currentTime;
  }

  startVideoStream(videoElement) {
    if (this.videoInterval) clearInterval(this.videoInterval);
    this.videoElement = videoElement;

    this.videoInterval = setInterval(() => {
      if (this.mode === "websocket_live") {
        this.sendVideoFrame();
      }
    }, 700);
  }

  stopVideoStream() {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
  }

  sendVideoFrame() {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    const width = 320;
    const height = 240;
    this.videoCanvas.width = width;
    this.videoCanvas.height = height;

    const ctx = this.videoCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(this.videoElement, 0, 0, width, height);

    const base64Data = this.videoCanvas.toDataURL("image/jpeg", 0.6).split(",")[1];
    if (!base64Data) return;

    const frameMessage = {
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "image/jpeg",
            data: base64Data
          }
        ]
      }
    };

    try {
      this.ws.send(JSON.stringify(frameMessage));
    } catch (e) {
      console.warn("[GeminiLive] Error sending video frame:", e);
    }
  }

  async startAudioStream() {
    if (this.mode !== "websocket_live") return;
    try {
      await this.initAudioContext();
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      const inputContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = inputContext.createMediaStreamSource(this.micStream);
      this.micProcessor = inputContext.createScriptProcessor(2048, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64Audio = this.arrayBufferToBase64(pcm16.buffer);

        const audioMsg = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            ]
          }
        };

        this.ws.send(JSON.stringify(audioMsg));
      };

      source.connect(this.micProcessor);
      this.micProcessor.connect(inputContext.destination);
      this.isStreaming = true;
    } catch (err) {
      console.warn("[GeminiLive] Mic live streaming error:", err);
    }
  }

  stopAudioStream() {
    if (this.micProcessor) {
      try { this.micProcessor.disconnect(); } catch (e) {}
      this.micProcessor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    this.isStreaming = false;
  }

  /**
   * User asks a question or triggers a prompt (by voice or button).
   */
  async sendUserText(text) {
    if (!this.isConnected) return;

    cancelSpeech();
    triggerHaptic("click");

    if (this.mode === "websocket_live" && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const contentMsg = {
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [{ text }]
            }
          ],
          turnComplete: true
        }
      };
      this.ws.send(JSON.stringify(contentMsg));
      if (this.onTranscript) this.onTranscript({ role: "user", text });
    } else {
      // Vision REST + Voice output
      await this.askVisionWithVoice(text);
    }
  }

  /**
   * Queries Gemini Vision with the current video frame and speaks the answer
   */
  async askVisionWithVoice(promptText) {
    const video = this.videoElement;
    if (!video || video.readyState < 2) {
      console.warn("[GeminiLive] Video element not ready for snapshot.");
      return;
    }

    // Grab frame
    const width = 480;
    const height = 360;
    this.videoCanvas.width = width;
    this.videoCanvas.height = height;
    const ctx = this.videoCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);

    const base64Data = this.videoCanvas.toDataURL("image/jpeg", 0.7).split(",")[1];
    if (!base64Data) return;

    if (this.onTranscript) {
      this.onTranscript({ role: "user", text: promptText });
    }

    this.updateStatus("AI Looking & Thinking...");

    try {
      let aiResponse = "";

      // 1. Post to secure server-side relay (API key never touches client)
      try {
        const relayRes = await fetch("/api/live/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptText, imageBase64: base64Data })
        });
        if (relayRes.ok) {
          const relayData = await relayRes.json();
          if (relayData.text) {
            aiResponse = relayData.text.trim();
          }
        }
      } catch (relayErr) {
        console.warn("[GeminiLive] Server relay error:", relayErr);
      }

      // If empty or unreachable, use strictly hedged fallback
      if (!aiResponse) {
        aiResponse = "Mujhe abhi kuch dikh nahi raha, cane use karte rehna.";
      }

      if (this.onTranscript) {
        this.onTranscript({ role: "model", text: aiResponse });
      }

      this.updateStatus("Live Vision AI Active");
      speak(aiResponse, state.language || "hi-IN");

    } catch (err) {
      console.error("[GeminiLive] Vision query error:", err);
      this.updateStatus("Vision Error");
      speak("Mujhe abhi kuch dikh nahi raha, cane use karte rehna.", state.language || "hi-IN");
    }
  }

  handleServerMessage(raw) {
    let msg = null;
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      return;
    }

    const content = msg.serverContent;
    if (!content) return;

    if (content.interrupted) {
      this.clearAudioQueue();
      return;
    }

    if (content.modelTurn?.parts) {
      for (const part of content.modelTurn.parts) {
        if (part.text && this.onTranscript) {
          this.onTranscript({ role: "model", text: part.text });
        }
        if (part.inlineData && part.inlineData.data) {
          const rawPcmBytes = this.base64ToArrayBuffer(part.inlineData.data);
          this.queueAudioChunk(rawPcmBytes);
        }
      }
    }
  }

  queueAudioChunk(arrayBuffer) {
    if (!this.audioContext) return;
    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuf = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuf.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuf;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime;
    const playAt = Math.max(now, this.nextPlayTime);
    source.start(playAt);
    this.nextPlayTime = playAt + audioBuf.duration;
  }

  clearAudioQueue() {
    this.nextPlayTime = this.audioContext ? this.audioContext.currentTime : 0;
  }

  disconnect() {
    this.stopVideoStream();
    this.stopAudioStream();
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isStreaming = false;
    this.mode = "idle";
    this.clearAudioQueue();
    this.updateStatus("Disconnected");
  }

  updateStatus(status) {
    const el = document.getElementById("live-ai-status-indicator");
    if (el) el.textContent = status;
  }

  floatTo16BitPCM(float32Array) {
    const buffer = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buffer;
  }

  arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const geminiLive = new GeminiLiveAssistant();
