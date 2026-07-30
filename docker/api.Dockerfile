FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/

RUN npm ci --omit=dev --workspace=@metris/api --workspace=@metris/db --workspace=@metris/shared

COPY packages ./packages
COPY apps/api ./apps/api

ENV NODE_ENV=production

CMD ["node", "apps/api/src/index.js"]
