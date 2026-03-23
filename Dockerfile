FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package descriptors
COPY package*.json ./

# Install dependencies (ignoring local anomalies)
RUN npm ci --only=production

# Bundle application sources
COPY . .

# Bind execution port
EXPOSE 3000

# Run secure instance
CMD ["node", "server.js"]
