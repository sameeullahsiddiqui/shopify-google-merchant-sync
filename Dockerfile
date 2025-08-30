# Docker Configuration (optional)
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production
RUN cd client && npm ci --only=production

# Copy source code
COPY . .

# Build client
RUN cd client && npm run build

# Create necessary directories
RUN mkdir -p data exports

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]

