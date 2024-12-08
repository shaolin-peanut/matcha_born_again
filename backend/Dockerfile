FROM node:18-alpine

WORKDIR /app

COPY backend/package.json backend/pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY backend .

EXPOSE 3000

CMD ["pnpm", "start"]