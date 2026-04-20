FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p /data
EXPOSE 3456
CMD ["node", "bin/n8n-manager.js", "dashboard", "--no-open", "--port", "3456"]
