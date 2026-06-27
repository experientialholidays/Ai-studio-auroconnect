# Use an official Node.js runtime as a parent image
FROM node:20-slim AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the client and server assets
RUN npm run build

# Stage 2: Production environment
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy production package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/submit.html ./submit.html
COPY --from=builder /app/dashboard.html ./dashboard.html
COPY --from=builder /app/contact.html ./contact.html
COPY --from=builder /app/common.js ./common.js
COPY --from=builder /app/firebase-applet-config.json* ./
COPY --from=builder /app/assets ./assets

# Expose port (Cloud Run will inject PORT at runtime, but we declare the default here)
EXPOSE 3000

# Define environment variables
ENV NODE_ENV=production

# Command to run the application
CMD ["npm", "run", "start"]
