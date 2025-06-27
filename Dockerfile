# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Only copy production dependencies and built files
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# If you use .env or other config files, copy them as well
# COPY .env ./

# Expose port (change if your server uses a different port)
EXPOSE 8080

# Start the MCP server
CMD ["node", "dist/index.js"]
