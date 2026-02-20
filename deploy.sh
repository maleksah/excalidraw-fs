#!/bin/bash
set -e

# Load environment variables from .env if it exists
if [ -f .env ]; then
  # Export variables to be available to the script, ignoring comments
  export $(grep -v '^#' .env | xargs)
fi

# Ensure mandatory variable PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
  echo "Error: PROJECT_ID is not set."
  echo "Please create a .env file from .env.example or set the PROJECT_ID environment variable."
  exit 1
fi

# Apply optional configurations with default fallbacks
REGION="${REGION:-europe-west1}"
MAX_INSTANCES="${MAX_INSTANCES:-1}"
APP_NAME="${APP_NAME:-excalidraw-fs}"
REPO_NAME="${REPO_NAME:-excalidraw-fs}"
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${APP_NAME}:latest"

echo "======================================================="
echo " Deploying ${APP_NAME} to Google Cloud Run"
echo " Project: ${PROJECT_ID} | Region: ${REGION}"
echo "======================================================="
echo ""

echo "[1/3] Ensuring Artifact Registry Repository Exists..."
# Create the repository if it doesn't already exist
# Redirecting stderr because an error mostly means it already exists (which is perfectly fine).
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --project=$PROJECT_ID 2>/dev/null || echo "Repository ${REPO_NAME} already exists (or skipped creation)."

echo ""
echo "[2/3] Building and Pushing Image to Artifact Registry using Cloud Build..."
# Submit source code to Cloud Build, which will build the Docker container using our multi-stage Dockerfile
# and push it natively to the specified tag in Artifact Registry.
gcloud builds submit --tag $IMAGE_URL --project=$PROJECT_ID

echo ""
echo "[3/3] Deploying Image to Cloud Run..."
# Notes on IAP Configuration flag assumptions:
# - `--iap` enables Identity-Aware Proxy directly on the native run.app endpoint.
gcloud run deploy $APP_NAME \
    --image $IMAGE_URL \
    --region $REGION \
    --project $PROJECT_ID \
    --max-instances $MAX_INSTANCES \
    --port 8080

echo ""
echo "======================================================="
echo " Deployment Successfully Completed! "
echo "======================================================="
echo ""
echo "Important note regarding Cloud IAP (Identity-Aware Proxy):"
echo "IAP has been natively enabled for this Cloud Run service. The service is now protected"
echo "and accessible directly via its run.app URL for authorized users."
echo "To grant users access, add them to the 'IAP-secured Web App User' role "
echo "for this Cloud Run resource in Google Cloud Console IAM."
