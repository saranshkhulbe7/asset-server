#!/bin/sh
# Start RabbitMQ in the background (detached mode)
echo "Starting RabbitMQ..."
rabbitmq-server -detached

# (Optional) Enable the RabbitMQ management plugin if you want the web UI.
rabbitmq-plugins enable rabbitmq_management

# Wait a few seconds to ensure RabbitMQ is up
sleep 5

# Start your Bun-based server in development mode
echo "Starting Bun server..."
bun run start
