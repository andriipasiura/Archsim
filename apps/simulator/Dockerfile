FROM node:26-alpine AS build
RUN npm install -g corepack@latest && corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter simulator...
RUN pnpm --filter simulator... build
RUN pnpm --filter simulator deploy --prod /out

FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .
USER node
CMD ["node", "dist/main.js"]
