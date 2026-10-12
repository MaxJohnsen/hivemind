FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY migrations migrations
COPY src src
ARG VERSION=dev
ENV HIVEMIND_VERSION=$VERSION HOST=0.0.0.0
USER node
EXPOSE 4100
CMD ["node", "src/server.ts"]
