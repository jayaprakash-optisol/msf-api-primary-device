FROM node:22-alpine

WORKDIR /webservice

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci 

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 8000


# Start the application
CMD ["npm", "start"] 