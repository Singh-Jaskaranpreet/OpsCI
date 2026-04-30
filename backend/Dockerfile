FROM python:3.11

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD sh -c "sleep 5 && python update_movies.py && uvicorn main:app --host 0.0.0.0 --port 8000"