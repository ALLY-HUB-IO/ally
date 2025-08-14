FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/hf-cache

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY services/sentiment-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

ARG SPACY_MODEL=en_core_web_sm
RUN python -m spacy download ${SPACY_MODEL}

COPY services/sentiment-service/app ./app
COPY services/sentiment-service/uvicorn_start.sh ./uvicorn_start.sh
RUN chmod +x uvicorn_start.sh

EXPOSE 8080
ENV PORT=8080

VOLUME ["/hf-cache"]

CMD ["./uvicorn_start.sh"]


