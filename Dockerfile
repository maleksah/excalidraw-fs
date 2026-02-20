# Stage 1: Build the Vite React App
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the project (output goes to /app/dist)
RUN npm run build

# Stage 2: Setup the minimal, secure Nginx server to serve static files
FROM nginx:alpine

# Copy custom Nginx configuration to listen on port 8080 (Cloud Run default)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Adjust permissions to allow Nginx to run as a non-root user for better security
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to the non-root user
USER nginx

# Expose port (Cloud Run sets the PORT env variable; here we explicitly configure 8080 via our custom config)
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
