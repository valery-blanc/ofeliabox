FROM python:3.12-alpine

WORKDIR /app

RUN pip install --no-cache-dir flask requests docker

COPY app.py .
COPY templates/ templates/

EXPOSE 8090

CMD ["python", "app.py"]
