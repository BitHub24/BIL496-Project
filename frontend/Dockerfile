# Build stage
FROM node:20 AS build
WORKDIR /app

# Allow Vite env variable to be passed in
ARG VITE_GOOGLE_OAUTH_CLIENT_ID
ENV VITE_GOOGLE_OAUTH_CLIENT_ID=$VITE_GOOGLE_OAUTH_CLIENT_ID

ENV NODE_OPTIONS=--openssl-legacy-provider

COPY package*.json ./
RUN npm install
COPY . .

# Vite will pick this up via import.meta.env.*
RUN npm run build

# Serve stage
FROM node:20-slim
ENV NODE_OPTIONS=--openssl-legacy-provider
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm install -g serve
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
