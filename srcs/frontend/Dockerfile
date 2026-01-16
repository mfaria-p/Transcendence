FROM node:20-alpine AS build WORKDIR /app
COPY . .
RUN npm install
RUN chmod +x ./entry.sh
CMD ["./entry.sh"]
