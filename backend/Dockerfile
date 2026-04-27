# Étape 1 : Choisir l'image de base
FROM python:3.9-slim

# Étape 2 : Définir le répertoire de travail
WORKDIR /app

# Étape 3 : Copier le fichier requirements.txt et installer les dépendances
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Étape 4 : Copier l'application FastAPI
COPY . .

# Étape 5 : Exposer le port sur lequel l'application tourne (par défaut 8000 pour FastAPI)
EXPOSE 8000

# Étape 6 : Lancer l'application avec Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]