FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm","run","build"]
