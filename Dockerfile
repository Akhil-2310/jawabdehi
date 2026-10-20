# One container: builds the static site, then runs the relayer, which serves the site and the API
# and writes to Arkiv. Mount a persistent volume at /data for photos, suggestions and invite codes.
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    DATA_DIR=/data
EXPOSE 8790
CMD ["npm", "start"]
