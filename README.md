# Excalidraw-fs

Excalidraw-fs is an enhanced, modern drawing and diagramming application built around the core [Excalidraw](https://excalidraw.com/) engine. It features a custom file explorer, local storage persistence, and a highly polished user interface with contemporary design aesthetics and smooth animations.

This project is built using:
- **React 19** & **TypeScript**
- **Vite** for fast development and building
- **Tailwind CSS** & **Framer Motion** for styling and animations
- **@excalidraw/excalidraw** for the core drawing canvas
- **IndexedDB** (`idb-keyval`) for local file storage persistence

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

### How to Run Locally

1. Install the project dependencies:
   ```bash
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the local URL provided in the terminal (usually `http://localhost:5173`).

### How to Build for Production

1. To create a production-ready build, run:
   ```bash
   npm run build
   ```
   This command will compile the TypeScript code and bundle the application into the `dist` folder.

2. To preview the production build locally and ensure everything works correctly before deployment, run:
   ```bash
   npm run preview
   ```

## Deployment via Google Cloud Run

This project includes an automated deployment script (`deploy.sh`) to build a highly optimized Docker container and securely deploy it to Google Cloud Run with Identity-Aware Proxy (IAP) enabled.

1. **Configure your Environment**
   Copy the provided `.env.example` file to create your own configuration:
   ```bash
   cp .env.example .env
   ```
   Open the `.env` file and set the required `PROJECT_ID`. Other fields (`REGION`, `MAX_INSTANCES`, etc.) are optional and will fall back to sensible defaults.

2. **Execute Deployment**
   Run the deployment script:
   ```bash
   ./deploy.sh
   ```

This script will automatically:
- Provision an Artifact Registry repository for your Docker images.
- Initiate a Cloud Build process using the optimizing multi-stage `Dockerfile`.
- Deploy the resulting Nginx-served static site container to Cloud Run.
- Secure the `run.app` endpoint natively using Google Cloud IAP, allowing access only to users possessing the "IAP-secured Web App User" IAM role.
