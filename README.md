# Note Forge

React + TypeScript + Vite app with Firebase (Auth/Firestore/Storage). The app can run locally, in Docker, and be deployed to Kubernetes. GitHub Actions builds and pushes the Docker image to Docker Hub.

## 1. Prerequisites

- Node.js 22+
- npm
- Docker Desktop (for Docker and local Kubernetes)
- kubectl (usually comes with Docker Desktop)

## 2. Local development (Vite dev server)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` (or `.env.development`) in the project root:

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. Run dev server:

   ```bash
   npm run dev
   ```

4. Open the app at http://localhost:5173.

## 3. Run with Docker (local)

1. Create `.env` in the project root (used by docker-compose):

   ```bash
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

2. Build and run with Docker Compose:

   ```bash
   docker-compose up --build
   ```

3. Open the app at http://localhost:8080.

## 4. CI/CD (GitHub Actions → Docker Hub)

Workflow: .github/workflows/ci.yml

On push to master/dev, GitHub Actions will:

- Install dependencies, lint, and build the app.
- Build a Docker image using dockerfile.
- Push the image to Docker Hub using DOCKERHUB_REPOSITORY, e.g. evangelionz/noteforge.

Required GitHub repo configuration:

- Secrets:
  - VITE_FIREBASE_API_KEY
  - VITE_FIREBASE_AUTH_DOMAIN
  - VITE_FIREBASE_PROJECT_ID
  - VITE_FIREBASE_STORAGE_BUCKET
  - VITE_FIREBASE_MESSAGING_SENDER_ID
  - VITE_FIREBASE_APP_ID
  - DOCKERHUB_USERNAME
  - DOCKERHUB_TOKEN
- Variables:
  - DOCKERHUB_REPOSITORY = evangelionz/noteforge

The Kubernetes Deployment refers to the latest tag:

- image: evangelionz/noteforge:latest

## 5. Deploy to Kubernetes (local cluster via Docker Desktop)

1. Enable Kubernetes in Docker Desktop settings.

2. Apply the manifest:

   ```bash
   kubectl apply -f k8s/note-forge.yaml
   ```

3. Check resources:

   ```bash
   kubectl get deploy,pod,svc
   ```

4. Port-forward the service to localhost:

   ```bash
   kubectl port-forward svc/note-forge 8080:80
   ```

5. Open the app at http://localhost:8080.

6. Delete resources when done:

   ```bash
   kubectl delete -f k8s/note-forge.yaml
   ```

This same image and manifest can be adapted for cloud Kubernetes clusters (GKE/AKS/EKS) by pointing them to the Docker Hub image evangelionz/noteforge.
