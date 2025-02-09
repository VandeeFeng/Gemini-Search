FROM node:20-alpine as builder

WORKDIR /app

# Set npm registry and other configurations
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm config set fetch-retries 3 && \
    npm config set fetch-retry-mintimeout 5000 && \
    npm config set fetch-retry-maxtimeout 60000

# Copy package files first for better cache utilization
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy configuration files
COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js theme.json ./
COPY drizzle.config.ts ./

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY db/ ./db/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Set npm registry and install ALL necessary dependencies
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install --production=false

# Copy built files and configs
COPY --from=builder /app/dist ./dist
COPY theme.json drizzle.config.ts ./

# Create necessary directories and files
RUN mkdir -p uploads logs && \
    touch .env && \
    chown -R node:node /app

# Use non-root user
USER node

# Expose port and set environment
EXPOSE 3010
ENV NODE_ENV=production \
    PORT=3010

# Start the application
CMD ["node", "dist/index.js"] 