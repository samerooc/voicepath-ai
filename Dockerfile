# VoicePath AI Production Container
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8000

# Copy application files
COPY package*.json ./
COPY server.js ./
COPY sw.js ./
COPY manifest.json ./
COPY index.html ./
COPY guard.html ./
COPY admin.html ./
COPY css/ ./css/
COPY data/ ./data/
COPY js/ ./js/

# Create non-root user for security
RUN addgroup -S voicepath && adduser -S voicepath -G voicepath && \
    mkdir -p /app/data/map-history && \
    chown -R voicepath:voicepath /app

USER voicepath

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

CMD ["node", "server.js"]
