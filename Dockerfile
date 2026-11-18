FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY servidor ./servidor
COPY cliente ./cliente

USER node
EXPOSE 3000
CMD ["node", "servidor/arranque.js"]
