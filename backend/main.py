from fastapi import FastAPI
from pathlib import Path
import json 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()
app.mount("/images", StaticFiles(directory="images"), name="images")

DATA_PATH = Path(__file__).parent / "movies.json"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/hello")
def hello():
    return {"message": "Hello World"}

@app.get("/movies")
def get_movies(limit: int = 10):
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        movies = json.load(f)
    
    return movies[:limit]