FROM node:20-alpine AS builder
WORKDIR /app

# Install ALL deps (including devDeps for build tools like vite, tsc)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
ARG VITE_GEMINI_API_KEY
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_PROJECT_ID
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Only production deps
COPY package*.json ./
RUN npm install --omit=dev

# Frontend build
COPY --from=builder /app/dist ./dist

# Backend files — ALL server modules must be copied here
COPY server.js          ./server.js
COPY firebase-admin.js  ./firebase-admin.js
COPY routes             ./routes
COPY constants          ./constants

# Expose Cloud Run default port
EXPOSE 8080

# Start server - must bind to 0.0.0.0:$PORT
CMD ["node", "server.js"]
