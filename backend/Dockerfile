# Use Node.js with all native dependencies for canvas
FROM node:20-bookworm

# Install native dependencies for canvas and sharp
# canvas requires: Cairo, Pango, libpng, libjpeg, giflib
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpng-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
