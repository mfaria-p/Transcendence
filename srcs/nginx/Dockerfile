FROM nginx:alpine
EXPOSE 80
EXPOSE 443
RUN apk add --no-cache openssl
COPY transcendence.conf /
RUN mkdir /cert
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /cert/transcendence.key -out /cert/transcendence.cer -config transcendence.conf
CMD ["nginx","-g","daemon off;","-c","/etc/nginx/nginx.conf"]
