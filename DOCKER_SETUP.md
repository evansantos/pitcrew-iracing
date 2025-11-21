# Docker Setup Guide

Complete guide for running the iRacing Race Engineer application with Docker, including the AI Race Engineer feature.

## Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd iracing-race-engineer

# 2. Copy environment file
cp .env.example .env.local

# 3. Start all services
docker-compose up -d

# 4. Watch the AI model being downloaded (first time only)
docker-compose logs -f ollama-setup

# 5. Access the application
# Frontend: http://localhost:3002
# API: http://localhost:3000
# Ollama: http://localhost:11434
```

## Services Overview

The Docker Compose stack includes:

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| `postgres` | `iracing-postgres` | 5432 | PostgreSQL 16 database |
| `redis` | `iracing-redis` | 6379 | Redis cache |
| `ollama` | `iracing-ollama` | 11434 | AI LLM service |
| `ollama-setup` | `iracing-ollama-setup` | - | One-time model download |
| `api` | `iracing-api` | 3000, 3001 | Backend API & WebSocket |
| `web` | `iracing-web` | 3002 | Next.js frontend |

## Volume Persistence

Data is persisted in Docker volumes:

```bash
# List volumes
docker volume ls | grep iracing

# Volumes created:
# - iracing-race-engineer_postgres_data  (Database)
# - iracing-race-engineer_redis_data     (Cache)
# - iracing-race-engineer_ollama_data    (AI models - largest)
```

## AI Configuration

### Default Setup

By default, the Ollama container will:
1. Start the Ollama service
2. Automatically download `llama3.1:8b` (~4GB)
3. Make the model available to the backend API

**First startup will take 5-10 minutes** while the model downloads.

### Using Different Models

#### Option 1: Environment Variable

```bash
# Use lighter model (2GB)
OLLAMA_MODEL=phi3:mini docker-compose up -d

# Use more powerful model (16GB+)
OLLAMA_MODEL=llama3.1:70b docker-compose up -d
```

#### Option 2: Update .env.local

```env
OLLAMA_MODEL=phi3:mini
```

Then restart:
```bash
docker-compose restart ollama ollama-setup
```

#### Option 3: Manual Model Management

```bash
# Enter the Ollama container
docker exec -it iracing-ollama bash

# List models
ollama list

# Pull a new model
ollama pull mistral:7b

# Remove a model
ollama rm llama3.1:8b
```

### Available Models

| Model | Size | RAM Required | Speed | Quality | Best For |
|-------|------|--------------|-------|---------|----------|
| `phi3:mini` | ~2GB | 4GB | ⚡⚡⚡ | ⭐⭐ | Low-end hardware, testing |
| `llama3.1:8b` | ~4GB | 8GB | ⚡⚡ | ⭐⭐⭐⭐ | **Recommended** |
| `mistral:7b` | ~4GB | 8GB | ⚡⚡ | ⭐⭐⭐⭐ | Alternative to llama3.1 |
| `llama3.1:70b` | ~40GB | 64GB+ | ⚡ | ⭐⭐⭐⭐⭐ | High-end servers |

## GPU Acceleration

### Prerequisites

1. NVIDIA GPU with CUDA support
2. [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

### Setup

1. **Install NVIDIA Container Toolkit:**

```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

2. **Enable GPU in docker-compose.yml:**

Uncomment the GPU configuration:

```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

3. **Restart Ollama:**

```bash
docker-compose up -d ollama
```

4. **Verify GPU Usage:**

```bash
# Check if GPU is detected
docker exec -it iracing-ollama nvidia-smi

# Monitor GPU usage while AI is running
watch -n 1 docker exec iracing-ollama nvidia-smi
```

## Common Operations

### Start/Stop Services

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d postgres redis ollama

# Stop all services
docker-compose down

# Stop but keep volumes
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f ollama

# Last 100 lines
docker-compose logs --tail=100 api
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart api
docker-compose restart ollama
```

### Update Services

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

## Troubleshooting

### AI Model Not Downloading

**Check logs:**
```bash
docker-compose logs ollama-setup
```

**Manually pull the model:**
```bash
docker exec -it iracing-ollama ollama pull llama3.1:8b
```

### Ollama Not Responding

**Check if service is running:**
```bash
docker-compose ps ollama
```

**Check health:**
```bash
docker inspect iracing-ollama --format='{{.State.Health.Status}}'
```

**Restart:**
```bash
docker-compose restart ollama
```

### Backend Can't Connect to Ollama

**Check environment variable:**
```bash
docker-compose exec api env | grep OLLAMA
# Should show: OLLAMA_BASE_URL=http://ollama:11434
```

**Test connection from API container:**
```bash
docker-compose exec api curl http://ollama:11434/api/tags
```

### Out of Disk Space

AI models are large. Check disk usage:

```bash
# Check Docker disk usage
docker system df

# Check volume sizes
docker system df -v
```

**Clean up unused data:**
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Full cleanup (⚠️ careful)
docker system prune -a --volumes
```

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the port
lsof -i :11434
lsof -i :5432

# Change ports in docker-compose.yml
# For example, change Ollama to 11435:11434
```

## Performance Tuning

### Memory Limits

Add memory limits to prevent OOM:

```yaml
ollama:
  deploy:
    resources:
      limits:
        memory: 8G  # Adjust based on model size
```

### CPU Allocation

```yaml
ollama:
  deploy:
    resources:
      limits:
        cpus: '4'  # Dedicate 4 CPU cores
```

### Model Context Size

Reduce memory usage by limiting context:

```bash
docker exec -it iracing-ollama bash

# Start with smaller context window
ollama run llama3.1:8b --ctx-size 2048
```

## Production Deployment

### Security Considerations

1. **Change default passwords** in `.env.local`
2. **Use secrets** for sensitive data
3. **Enable HTTPS** with a reverse proxy
4. **Restrict network access** to internal services

### Reverse Proxy Setup

Example Nginx configuration:

```nginx
# Frontend
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api {
        proxy_pass http://localhost:3000;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Monitoring

Add monitoring containers:

```yaml
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus:latest
  ports:
    - '9090:9090'

grafana:
  image: grafana/grafana:latest
  ports:
    - '3003:3000'
```

## Backup and Restore

### Backup Volumes

```bash
# Backup Ollama models
docker run --rm -v iracing-race-engineer_ollama_data:/data -v $(pwd):/backup alpine tar czf /backup/ollama-backup.tar.gz -C /data .

# Backup database
docker exec iracing-postgres pg_dump -U postgres race_engineer > backup.sql
```

### Restore Volumes

```bash
# Restore Ollama models
docker run --rm -v iracing-race-engineer_ollama_data:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/ollama-backup.tar.gz"

# Restore database
docker exec -i iracing-postgres psql -U postgres race_engineer < backup.sql
```

## Development vs Production

### Development Mode

```bash
# Use docker-compose.yml
docker-compose up -d

# Features:
# - Hot reload for code changes
# - Volume mounts for source code
# - Debug logging enabled
```

### Production Mode

```bash
# Use docker-compose.prod.yml (to be created)
docker-compose -f docker-compose.prod.yml up -d

# Features:
# - Optimized builds
# - No source code mounts
# - Production logging
# - Resource limits
```

## Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Ollama Docker Documentation](https://hub.docker.com/r/ollama/ollama)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/)

---

**Need help?** Check the main [README.md](./README.md) or open an issue on GitHub.
