FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY telegram-bot/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd -m -u 10001 arena
COPY backend/app ./app
COPY telegram-bot/bot.py ./bot.py
USER arena
CMD ["python", "bot.py"]
