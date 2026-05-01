# OPSCI – Movie Recommendation Platform

## Description

OPSCI est une application de recommandation de films basée sur une architecture microservices.

Elle comprend :
- Frontend (Nginx + HTML/JS)
- Backend (FastAPI)
- Service de recommandation
- Base de données PostgreSQL


## 1. Architecture

```
                   ┌──────────────────────────────────────────────┐
                   │                  Votre PC                    │
                   │                                              │
   http://localhost:8080 ──┐                                      │
                           │                                      │
 ┌─────────────────────────┼──────────────────────────────────────┘
 │                         ▼
 │   ┌────────────────────────────┐
 │   │     frontend (Nginx)       │     frontend-net
 │   │  Static files + /api proxy │─────────────────┐
 │   └────────────────────────────┘                 │
 │                                                  ▼
 │                                        ┌────────────────────┐
 │                                        │      backend       │
 │                                        │    (FastAPI :8000) │
 │                                        └──┬───────────────┬─┘
 │                                           │               │
 │                              backend-net  │               │  backend-net
 │                               (internal)  ▼               ▼  (internal)
 │                                  ┌────────────────┐  ┌────────────┐
 │                                  │ recommendation │  │  postgres  │
 │                                  │ (FastAPI :8001)│  │   :5432    │
 │                                  └────────────────┘  └────────────┘
 └──── Docker host ───────────────────────────────────────────────────
```

**Règles de réseau strictement respectées :**

| De              | Vers            | Réseau          | Port exposé à l'hôte ? |
|-----------------|-----------------|-----------------|------------------------|
| Votre PC        | frontend        | bridge          | ✅ `${FRONTEND_PORT:-8080}` → 80 |
| frontend        | backend         | `frontend-net`  | ❌ interne |
| backend         | recommendation  | `backend-net`   | ❌ interne |
| backend         | postgres        | `backend-net`   | ❌ interne |
| recommendation  | postgres        | `backend-net`   | ❌ interne |

- `backend-net` est marqué `internal: true` : **pas d'accès depuis l'hôte ni vers Internet**.
- Le backend est sur les DEUX réseaux (c'est l'unique pont entre le frontend et les services internes).
- Le frontend JS appelle `/api/...` (URL relative). Nginx, dans le conteneur frontend, fait le reverse-proxy vers `http://backend:8000` via le DNS interne Docker.

---

## 2. Prérequis

*   **Docker & Docker Compose** : Docker Engine ≥ 24 et Docker Compose v2.
*   **Token TMDB** : Indispensable pour récupérer les informations des films. Obtenez-le sur [themoviedb.org](https://www.themoviedb.org/settings/api).
*   **Fichier d'environnement** : Un fichier `.env` à la racine est nécessaire pour injecter votre token.

---

## 3. Démarrage rapide

### 1. Configuration de l'environnement
Le projet ne peut pas fonctionner sans clé API. Vous devez créer un fichier `.env` pour que Docker puisse l'utiliser.

```bash
# Créer le fichier .env à partir du template
cp .env.example .env

# Ouvrez le fichier .env et ajoutez votre token :
# TMDB_TOKEN=votre_cle_api_ici

# 2. Build + run
docker compose up --build -d

# 3. Ouvrir l'application
open http://localhost:8080
```

### Initialiser la base (une seule fois)

Le script `update_movies.py` peuple la DB avec TMDB :

```bash
docker compose exec backend python update_movies.py
```

### Voir les logs

```bash
docker compose logs -f backend
docker compose logs -f recommendation
docker compose logs -f frontend
```

### Arrêter / nettoyer

```bash
docker compose down          # arrête, garde les volumes
docker compose down -v       # arrête ET supprime la DB
```

---

## 4. Variables d'environnement

| Variable            | Utilisée par                  | Défaut         |
|---------------------|-------------------------------|----------------|
| `POSTGRES_USER`     | postgres, backend, reco       | `postgres`     |
| `POSTGRES_PASSWORD` | postgres, backend, reco       | **requis**     |
| `POSTGRES_DB`       | postgres, backend, reco       | `movies_db`    |
| `TMDB_TOKEN`        | backend (`update_movies.py`)  | **requis**     |
| `FRONTEND_PORT`     | hôte → frontend               | `8080`         |

---

## 5. Images produites

| Service        | Image                                | Base              |
|----------------|--------------------------------------|-------------------|
| frontend       | `singhflix/frontend:latest`          | `nginx:1.27-alpine` |
| backend        | `singhflix/backend:latest`           | `python:3.11-slim` |
| recommendation | `singhflix/recommendation:latest`    | `python:3.11-slim` |
| postgres       | `postgres:16-alpine`                 | officielle        |

Toutes les images personnalisées tournent avec un utilisateur **non-root** et un **healthcheck**.

---

## 6. Tests

```bash
# Backend (15 tests - endpoints FastAPI avec SQLite en mémoire)
cd backend && pip install -r requirements.txt && pytest -v

# Recommendation (10 tests - moteur de reco)
cd recommendation && pip install -r requirements.txt && pytest -v

# Avec coverage
pytest -v --cov=. --cov-report=term
```

Les tests tournent **sans Postgres** grâce à SQLite in-memory + un stub sur
l'appel HTTP sortant vers le service de recommandation.

---

## 7. CI/CD (Pipeline GitLab)

Le projet utilise un pipeline **GitLab CI** automatisé pour garantir la qualité du code et la validité des conteneurs. Le workflow est configuré pour se déclencher sur les branches `main`, `feature/front-back` et `test`.

### Stages du Pipeline :

1.  **Test (Structure)** : 
    - **Job `check-files`** : Vérifie la présence des dossiers et fichiers essentiels (tests, requirements) pour s'assurer que l'arborescence du projet est correcte avant de lancer les processus lourds.

2.  **Unit-Test (Tests Unitaires)** :
    - **Frontend** : Exécution de tests avec `Jest` pour valider la logique JavaScript. Les résultats sont exportés au format JUnit.
    - **Backend & Recommendation** : Utilisation de `Pytest` avec le module `pytest-cov`. Le pipeline génère :
        - Des rapports de couverture de code (**Cobertura**).
        - Des rapports de tests (**JUnit**) intégrés nativement dans l'interface GitLab pour un suivi visuel des échecs.

3.  **Build-Docker** :
    - **Job `build-microservices`** : Utilise un service *Docker-in-Docker* (DinD) pour exécuter `docker compose build`. Ce stage garantit que les Dockerfiles de chaque micro-service (Frontend, Backend, Reco) sont fonctionnels et que les dépendances s'installent correctement.

4.  **Deploy (GitLab Pages)** :
    - **Job `pages`** : Réservé exclusivement à la branche `main`. Il déploie automatiquement l'interface utilisateur statique (HTML/CSS/JS) sur **GitLab Pages**. Cela permet de visualiser le rendu du frontend en ligne sans déploiement complexe.

### Points clés de l'automatisation :

*   **Gestion des Artifacts** : Les rapports de tests et de couverture sont conservés par GitLab, permettant de bloquer le merge si la qualité baisse.
*   **Environnement Isolé** : Chaque job s'exécute dans un conteneur dédié (`node:18` ou `python:3.11-slim`), assurant la reproductibilité des tests.
*   **Sécurité des Secrets** : Le pipeline est conçu pour fonctionner sans fichier `.env` physique, en utilisant les variables d'environnement sécurisées de GitLab pour les futurs déploiements.

---

## 8. Choix techniques - justification rapide

* **Nginx en reverse-proxy** : indispensable pour respecter la contrainte "backend non exposé au PC" tout en laissant un frontend JS statique appeler l'API depuis le navigateur (même-origine, zéro CORS).
*   **Architecture Micro-services** : Découpage de l'application en quatre services distincts (Frontend, Backend, Reco, DB). Cela permet de faire évoluer chaque composant indépendamment et facilite la maintenance.
*   **Orchestration ordonnée (`depends_on`)** : Utilisation de clauses de dépendance pour garantir que la base de données et le moteur de recommandation sont prêts avant que le backend ne tente de s'y connecter, évitant ainsi les crashs au démarrage.
*   **Persistance des données (Volumes nommés)** : Utilisation du volume `pgdata` pour PostgreSQL. Cela garantit que les données (films, utilisateurs) ne sont pas supprimées lorsque le conteneur est arrêté ou mis à jour.
*   **Images légères (Slim/Alpine)** : Utilisation de versions "slim" pour les images Python et Postgres afin de minimiser l'empreinte disque, d'accélérer le temps de build sur le pipeline GitLab et de réduire la surface d'attaque.
*   **Sécurisation des secrets par variables d'environnement** : Le token TMDB n'est jamais écrit en dur. La syntaxe `${TMDB_TOKEN}` permet de l'injecter dynamiquement depuis un fichier `.env` local (ignoré par Git) ou depuis les variables secrètes de GitLab CI.
*   **Relancement automatique (`restart: always`)** : Appliqué aux services critiques comme la base de données et le moteur de recommandation pour garantir la haute disponibilité de l'application en cas de crash interne.

---

## 9. Tests manuels post-démarrage

```bash
# 1. Le backend N'EST PAS joignable depuis l'hôte (attendu)
curl -s --max-time 3 http://localhost:8000/hello && echo "PROBLEME" || echo "OK: backend non exposé"

# 2. Le frontend est joignable
curl -s http://localhost:8080/ | grep -q SINGHFLIX && echo "OK: frontend UP"

# 3. Le reverse-proxy marche (frontend -> backend via réseau interne)
curl -s http://localhost:8080/api/hello
# => {"message":"Hello World"}

# 4. De l'intérieur du backend, postgres et reco sont joignables
docker compose exec backend curl -s http://recommendation:8001/docs | head -c 80
docker compose exec backend python -c "import psycopg2, os; psycopg2.connect(os.environ['DATABASE_URL']); print('DB OK')"
```

---

## Lancement du projet

Un script unique permet de lancer automatiquement toute l’application.

### Exécution

```bash
chmod +x run.sh
./run.sh