# Multi-stage Dockerfile for deployment on supported Docker hosts
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci || npm install

COPY . .

# Apply the KCC Brain scale-to-zero guards before the production build.
# Railway builds directly from main and does not execute GitHub CI patch steps.
RUN node scripts/applyBrainScaleZero.mjs
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/.env.example ./.env.example

# Render Free and similar no-card hosts run the service as a non-root user.
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
