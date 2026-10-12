FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY migrations migrations
COPY src src
USER node
ENV HOST=0.0.0.0
EXPOSE 4100
CMD ["node", "src/server.ts"]
