FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache gettext
COPY . .
RUN npm install
CMD ["npm","run","build"]
