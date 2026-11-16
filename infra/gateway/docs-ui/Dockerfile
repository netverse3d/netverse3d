FROM docker.swagger.io/swaggerapi/swagger-ui:v5.34.1@sha256:59ee9021a8884437c7fd8aae79e0a46ee6b6dd3afd7f24a587c4501585fde53b

COPY infra/gateway/docs/ /usr/share/nginx/html/
COPY infra/gateway/docs-ui/nginx.conf /etc/nginx/nginx.conf

ENV BASE_URL=/docs
ENV CONFIG_URL=/docs/config.json

RUN node /usr/share/nginx/configurator /usr/share/nginx/html/swagger-initializer.js

USER 101:101

ENTRYPOINT []
CMD ["nginx", "-g", "daemon off;"]
