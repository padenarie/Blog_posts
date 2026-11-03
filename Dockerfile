# --- build stage ---
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS build
WORKDIR /app
ARG UMAMI_SCRIPT_URL
ARG UMAMI_WEBSITE_ID
COPY package*.json ./
RUN npm ci
COPY content ./content
COPY src ./src
COPY assets ./assets
RUN npm run build

# --- serve stage ---
FROM nginx:alpine@sha256:62ff2089abf5a9ed33bd232895bef5e22f7bb4b200675cec49a5ebc48e3d4ac8
RUN apk add --no-cache logrotate && mkdir -p /var/log/nginx/analytics /etc/nginx/real-ip
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/analytics/logrotate.conf /etc/logrotate.d/blog-analytics
COPY deploy/analytics/start-crond.sh /docker-entrypoint.d/40-start-crond.sh
COPY deploy/analytics/configure-real-ip.sh /docker-entrypoint.d/30-configure-real-ip.sh
RUN chmod +x /docker-entrypoint.d/30-configure-real-ip.sh /docker-entrypoint.d/40-start-crond.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
