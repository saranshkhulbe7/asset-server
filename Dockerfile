FROM oven/bun:latest
WORKDIR /app

# Copy package files and install production dependencies using Bun
COPY package*.json ./
RUN bun install --production

# Copy your source code into the container
COPY . .

# Update package list and install ffmpeg, Ghostscript, RabbitMQ, and Erlang.
RUN apt-get update && \
    apt-get install -y ffmpeg ghostscript rabbitmq-server erlang-nox && \
    rm -rf /var/lib/apt/lists/*

# Copy the entrypoint script into the container and make it executable
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose your server port (8000) and RabbitMQ management port (15672)
EXPOSE 8000 15672

# Start both RabbitMQ and your server using the entrypoint script
CMD ["/app/entrypoint.sh"]
