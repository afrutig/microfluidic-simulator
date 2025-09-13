# Build stage
FROM node:20-alpine AS build
WORKDIR /app/frontend

# Install deps
COPY frontend/package.json frontend/package-lock.json* frontend/pnpm-lock.yaml* frontend/yarn.lock* ./
RUN if [ -f package-lock.json ]; then (npm ci || npm i); else npm i; fi

# Copy source and OpenAPI spec
COPY frontend /app/frontend
COPY api/openapi.json /app/api/openapi.json

# Ensure deps are synced after full source copy (handles new deps)
RUN npm i

# Bake vtk.js into the public assets so it is always available at /vtkjs/vtk.js
RUN mkdir -p public/vtkjs && \
    (cp node_modules/@kitware/vtk.js/dist/vtk.js public/vtkjs/vtk.js || \
     wget -q -O public/vtkjs/vtk.js https://unpkg.com/@kitware/vtk.js@29.7.1/dist/vtk.js)

# Generate types and build
ARG API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$API_BASE_URL
RUN npm run gen:api:local && npm run build

# Runtime stage
FROM nginx:1.25-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
