# VoicePath AI Production Deployment Guide

## 1. Why HTTPS is Strictly Mandatory
The browser Web APIs required by VoicePath AI for blind users require a **Secure Context (HTTPS or localhost)**:
- `navigator.mediaDevices.getUserMedia` (Camera feed & Microphone for speech recognition and live vision)
- `navigator.wakeLock` (Keeping screen alive during navigation)
- `navigator.vibrate` / Sensor APIs (Haptics, accelerometer, gyroscope)

In plain HTTP over a non-localhost network (e.g. `http://192.168.1.10:8000`), the browser will refuse camera and microphone permissions automatically.

---

## 2. Running with Docker & Caddy (Automatic HTTPS)

The recommended setup uses **Caddy** as a reverse proxy, which automatically provisions Let's Encrypt SSL/TLS certificates.

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  app:
    build: .
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=8000
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - SESSION_SECRET=${SESSION_SECRET}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - GUARD_PASSWORD=${GUARD_PASSWORD}
    networks:
      - voicepath-net

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - voicepath-net
    depends_on:
      - app

networks:
  voicepath-net:

volumes:
  caddy_data:
  caddy_config:
```

### `Caddyfile`
```caddy
yourdomain.com {
    reverse_proxy app:8000
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

---

## 3. Nginx Reverse Proxy Alternative

If deploying behind Nginx:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Environment Variables Checklist

| Variable | Description | Required | Default |
|---|---|---|---|
| `PORT` | Listening port for VoicePath server | No | `8000` |
| `NODE_ENV` | Environment (`development` or `production`) | No | `development` |
| `GEMINI_API_KEY` | Server-side Gemini API key (never shared with clients) | Yes for Live AI | `""` |
| `SESSION_SECRET` | Secret key for hashing & session validation | Recommended | Random 32 bytes |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed domains | No | `localhost,127.0.0.1,capacitor://localhost` |
| `ADMIN_PASSWORD` | Strong password for building staff/admin portal | Yes | `AdminSaathi@2026` |
| `GUARD_PASSWORD` | Strong password for security guard portal | Yes | `GuardSaathi@2026` |
