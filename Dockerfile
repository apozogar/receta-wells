FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /usr/src/app
COPY --from=build /usr/src/app/dist/menubox/browser ./dist/menubox/browser
COPY server/package*.json ./server/
RUN cd server && npm install
COPY server/ ./server/
EXPOSE 10000
CMD ["node", "server/server.js"]
