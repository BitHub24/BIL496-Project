FROM node:20 AS build
WORKDIR /app

# Accept secrets as build args
ARG VITE_GOOGLE_OAUTH_CLIENT_ID
ARG VITE_BACKEND_API_URL

ENV NODE_OPTIONS=--openssl-legacy-provider

COPY package*.json ./
RUN npm install

COPY . .

# 👇 Create .env.production dynamically
RUN echo "VITE_GOOGLE_OAUTH_CLIENT_ID=${VITE_GOOGLE_OAUTH_CLIENT_ID}" >> .env.production && \
    echo "VITE_BACKEND_API_URL=${VITE_BACKEND_API_URL}" >> .env.production


# Build using .env.production (Vite picks it up automatically)
RUN npm run build

# Serve stage
FROM node:20-slim
ENV NODE_OPTIONS=--openssl-legacy-provider
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm install -g serve
EXPOSE 8080
CMD ["serve", "-s", "dist", "-l", "8080"]
