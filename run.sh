#!/bin/bash

echo "====================================="
echo " OPSCI PROJECT RUNNER"
echo "====================================="
echo "Choose mode:"
echo "1) Docker"
echo "2) Kubernetes"
echo "3) Clean everything"
echo "4) Run manually (no Docker / no K8s)"
echo "====================================="

read -p "Enter choice: " choice

# ================= DOCKER =================
if [ "$choice" == "1" ]; then
    echo "🐳 Running with Docker..."

    # ensure local docker
    eval $(minikube docker-env -u)

    docker compose down -v
    docker compose up -d --build

    echo "Conteneters are runnging"
    docker ps 

    echo "====================================="
    echo "Docker architecture:"
    echo "- frontend (nginx)"
    echo "- backend (FastAPI)"
    echo "- reco service"
    echo "- postgres (official image)"
    echo "All connected via docker network"
    echo "====================================="

    echo "👉 Open: http://127.0.0.1:3000/index.html"


# ================= KUBERNETES =================
elif [ "$choice" == "2" ]; then
    echo "☸️ Running with Kubernetes..."

    # Start cluster
    minikube start --memory=2500mb --cpus=2
    eval $(minikube docker-env)

    echo "🔨 Building images inside Minikube..."
    docker build -t opsci-backend ./backend
    docker build -t opsci-frontend ./frontend
    docker build -t opsci-reco ./recommendation

    echo "📦 Creating namespace..."
    kubectl apply -f k8s/namespace.yaml

    echo "🔐 Applying secrets & config..."
    kubectl apply -f k8s/secret.yaml
    kubectl apply -f k8s/tmdb-secret.yaml
    kubectl apply -f k8s/configmap.yaml

    echo "🗄️ Deploying database..."
    kubectl apply -f k8s/db/

    echo "⏳ Waiting for database to be ready..."
    kubectl wait --for=condition=ready pod -l app=db -n opsci --timeout=60s

    echo "⚙️ Deploying backend & reco..."
    kubectl apply -f k8s/backend/
    kubectl apply -f k8s/recommendation/

    echo "🌐 Deploying frontend..."
    kubectl apply -f k8s/frontend/

    echo "⏳ Waiting for all pods..."
    kubectl wait --for=condition=ready pod --all -n opsci --timeout=120s

    echo "🌐 Enabling ingress..."
    minikube addons enable ingress

    echo "⏳ Waiting for ingress controller..."
    kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=90s

    echo "🚀 Applying ingress..."
    kubectl apply -f k8s/ingress.yaml

    echo "📊 Final status:"
    kubectl get all -n opsci

    echo "====================================="
    echo "Kubernetes architecture:"
    echo "- 1 cluster (Minikube)"
    echo "- Multiple pods:"
    echo "   • frontend pod"
    echo "   • backend pod"
    echo "   • reco pod"
    echo "   • postgres pod"
    echo "- Services expose pods internally"
    echo "- Ingress exposes app externally"
    echo "- ConfigMap & Secrets manage config"
    echo "====================================="

    echo "=====================================" 
    echo "✅ Kubernetes deployment complete" 
    echo "=====================================" 
    echo "👉 Access:" 
    echo "http://opsci.local (Ingress)" 
    echo "" 
    echo "If ingress fails:"
    echo "minikube service frontend -n opsci"


# ================= CLEAN =================
elif [ "$choice" == "3" ]; then
    echo "🧹 Cleaning everything..."

    echo "🔄 Switching to local Docker..."
    eval $(minikube docker-env -u)

    echo "🐳 Cleaning Docker..."
    docker compose down -v 2>/dev/null

    echo "🧼 Removing project images..."
    docker rmi opsci-backend opsci-frontend opsci-reco 2>/dev/null

    echo "🧹 Removing unused volumes..."
    docker volume prune -f

    echo "🧹 Removing unused images (safe)..."
    docker image prune -f

    echo "☸️ Deleting Kubernetes cluster..."
    minikube delete 2>/dev/null

    echo "🧼 Removing namespace if exists..."
    kubectl delete namespace opsci --ignore-not-found 2>/dev/null

    echo "✅ Clean environment ready"
    


# ================= MANUAL =================
# ================= MANUAL =================

elif [ "$choice" == "4" ]; then
echo "🧠 Running WITHOUT Docker/Kubernetes"

    echo "👉 Open 3 terminals:"

    echo ""
    echo "Terminal 1 (Backend):"
    echo "cd backend"
    echo "python3 -m venv venv"
    echo "source venv/bin/activate"
    echo "pip install -r requirements.txt"
    echo "uvicorn main:app --reload --port 8000"

    echo ""
    echo "Terminal 2 (Recommendation):"
    echo "cd recommendation"
    echo "python3 -m venv venv"
    echo "source venv/bin/activate"
    echo "pip install -r requirements.txt"
    echo "uvicorn recom:app --reload --port 8001"

    echo ""
    echo "Terminal 3 (Frontend):"
    echo "cd frontend"
    echo "python3 -m http.server 3000"

    echo ""
    echo "====================================="
    echo "Manual architecture:"
    echo "- frontend: http://localhost:3000"
    echo "- backend: http://localhost:8000"
    echo "- reco: http://localhost:8001"
    echo "- postgres must be running locally"
    echo "====================================="

# ================= ERROR =================
else
    echo "❌ Invalid choice"
fi