FROM node:18 AS build
WORKDIR /app
ENV NODE_OPTIONS=--openssl-legacy-provider
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
FROM node:18-slim
WORKDIR /app
COPY --from=build /app/build ./build
RUN npm install -g serve
EXPOSE 8080
CMD ["serve", "-s", "build", "-l", "8080"]
