FROM python:3.12.12-alpine3.22
WORKDIR /app
COPY analytics /app/analytics
RUN adduser -D -u 10001 analytics && mkdir /data && chown analytics:analytics /data
USER analytics
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "analytics.collector"]
