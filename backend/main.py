from fastapi import FastAPI
from pathlib import Path
import json 
app = FastAPI()

DATA_PATH = Path(__file__).parent / "movies.json"

@app.get("/hello")
def hello():
    return {"message": "Hello World"}

@app.get("/movies")
def get_movies(limit: int = 10):
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        movies = json.load(f)
    
    return movies[:limit]