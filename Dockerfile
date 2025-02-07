FROM node:20-alpine as builder

WORKDIR /app

# Set npm registry and other configurations
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm config set fetch-retries 3 && \
    npm config set fetch-retry-mintimeout 5000 && \
    npm config set fetch-retry-maxtimeout 60000

# Copy package files and configuration files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY theme.json ./
COPY .env ./

# Install all dependencies for building
RUN npm install

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY db/ ./db/
COPY drizzle.config.ts ./

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Set npm registry for production stage
RUN npm config set registry https://registry.npmmirror.com/

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env ./

# Copy necessary configuration files
COPY drizzle.config.ts ./
COPY theme.json ./

# Create necessary directories
RUN mkdir -p uploads logs && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose the port the app runs on
EXPOSE 3010

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3010

# Start the application
CMD ["node", "dist/index.js"] 