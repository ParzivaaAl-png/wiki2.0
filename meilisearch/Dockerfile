FROM getmeili/meilisearch:v1.7.6

USER root

# Install Nginx
RUN apk add --no-cache nginx

# Copy configurations and script
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7700

ENTRYPOINT ["tini", "--", "/entrypoint.sh"]
CMD []

