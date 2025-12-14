# Deployment Guide - RHEL VM with Podman + PostgreSQL

## 🎯 Deployment Overview

Deploy the Ideation App to a RHEL VM using Podman containers and PostgreSQL database.

**Architecture:**
- PostgreSQL on host (already installed)
- Backend API in Podman container
- Frontend in Podman container
- Nginx reverse proxy in Podman container
- All containers in a single Podman pod

**Target Capacity:** 100+ concurrent users

---

## Prerequisites

✅ RHEL 8.10+ VM with:
- Podman installed
- PostgreSQL installed and running
- Node.js 18+ (for building)
- Git (for cloning repository)

---

## Part 1: PostgreSQL Setup

### Step 1: Create Database and User

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database and user
psql
```

```sql
-- Create database
CREATE DATABASE ideation;

-- Create user with password
CREATE USER ideation_app WITH PASSWORD 'your_secure_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ideation TO ideation_app;

-- Connect to database
\c ideation

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO ideation_app;

-- Exit
\q
```

### Step 2: Configure PostgreSQL for Remote Connections

Edit `/var/lib/pgsql/data/postgresql.conf`:
```bash
sudo vi /var/lib/pgsql/data/postgresql.conf
```

Add/modify:
```conf
listen_addresses = 'localhost'  # or '*' if containers need access
port = 5432
max_connections = 100
```

Edit `/var/lib/pgsql/data/pg_hba.conf`:
```bash
sudo vi /var/lib/pgsql/data/pg_hba.conf
```

Add:
```conf
# Allow connections from containers (adjust as needed)
host    ideation    ideation_app    127.0.0.1/32    scram-sha-256
host    ideation    ideation_app    172.16.0.0/12   scram-sha-256  # Podman network range
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Step 3: Initialize Database Schema

Create migration script:
```bash
cd /path/to/plausible_futures
cat > backend/migrations/001_initial_schema.sql << 'EOF'
-- Create tables
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  session_state TEXT DEFAULT 'setup',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP,
  voting_enabled_at TIMESTAMP,
  finalized_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  topic_id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, topic_id)
);

CREATE TABLE IF NOT EXISTS session_participants (
  session_id TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  status TEXT DEFAULT 'joined',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  PRIMARY KEY (session_id, participant_id)
);

CREATE TABLE IF NOT EXISTS contributions (
  contribution_id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(session_id) ON DELETE CASCADE,
  topic_id TEXT REFERENCES topics(topic_id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL,
  current_status TEXT,
  minor_impact TEXT,
  disruption TEXT,
  reimagination TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, topic_id, participant_id)
);

CREATE TABLE IF NOT EXISTS votes (
  vote_id TEXT PRIMARY KEY,
  contribution_id TEXT REFERENCES contributions(contribution_id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contribution_id, voter_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_state ON sessions(session_state);
CREATE INDEX IF NOT EXISTS idx_sessions_moderator ON sessions(moderator_id);
CREATE INDEX IF NOT EXISTS idx_topics_session ON topics(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON session_participants(status);
CREATE INDEX IF NOT EXISTS idx_contributions_session ON contributions(session_id);
CREATE INDEX IF NOT EXISTS idx_contributions_topic ON contributions(topic_id);
CREATE INDEX IF NOT EXISTS idx_votes_contribution ON votes(contribution_id);
EOF
```

Run migration:
```bash
PGPASSWORD='your_secure_password_here' psql -h localhost -U ideation_app -d ideation -f backend/migrations/001_initial_schema.sql
```

---

## Part 2: Backend Migration to PostgreSQL

### Step 1: Install PostgreSQL Driver

```bash
cd backend
npm install pg
```

### Step 2: Create New Database Module

Create `backend/db-postgres.js`:
```bash
cat > backend/db-postgres.js << 'EOF'
import pg from 'pg';

const { Pool } = pg;

// Connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ideation',
  user: process.env.DB_USER || 'ideation_app',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Helper to convert PostgreSQL rows to match sql.js API
const dbWrapper = {
  prepare: (sql) => {
    return {
      run: async (...params) => {
        const result = await pool.query(sql, params);
        return { changes: result.rowCount };
      },
      get: async (...params) => {
        const result = await pool.query(sql, params);
        return result.rows[0];
      },
      all: async (...params) => {
        const result = await pool.query(sql, params);
        return result.rows;
      }
    };
  },
  exec: async (sql) => {
    await pool.query(sql);
  }
};

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error:', err);
});

export default dbWrapper;
EOF
```

### Step 3: Update Environment Variables

Create `backend/.env.production`:
```bash
cat > backend/.env.production << 'EOF'
NODE_ENV=production
PORT=3001

# PostgreSQL Configuration
DB_HOST=host.containers.internal
DB_PORT=5432
DB_NAME=ideation
DB_USER=ideation_app
DB_PASSWORD=your_secure_password_here

# API Configuration
CORS_ORIGIN=http://your-vm-ip:8080
EOF
```

### Step 4: Update Routes to Use Async/Await

**Important:** PostgreSQL operations are async, so update all routes:

```javascript
// Old (sql.js - sync):
const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);

// New (PostgreSQL - async):
const session = await db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId);
```

You'll need to:
1. Add `async` to all route handlers
2. Add `await` to all `db.prepare()...get()`, `.run()`, `.all()` calls
3. Update `db.exec()` calls to be async

### Step 5: Switch Database Module

Update `backend/routes/*.js` to use PostgreSQL:
```javascript
// Change this line in all route files:
import db from '../db.js';

// To:
import db from '../db-postgres.js';
```

Or create a symlink:
```bash
cd backend
ln -sf db-postgres.js db-active.js
# Then use: import db from '../db-active.js';
```

---

## Part 3: Build Application

### Step 1: Build Frontend

```bash
# From project root
npm install
npm run build

# This creates dist/ folder with optimized static files
```

### Step 2: Build Backend

```bash
cd backend
npm install --production
```

---

## Part 4: Containerization with Podman

### Step 1: Create Dockerfiles

**Backend Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application files
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]
```

**Frontend Dockerfile** (`Dockerfile`):
```dockerfile
FROM nginx:alpine

# Copy built frontend
COPY dist/ /usr/share/nginx/html/

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Nginx Config** (`nginx.conf`):
```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    upstream backend {
        server backend:3001;
    }

    server {
        listen 80;
        server_name _;

        # Frontend
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        # Backend API proxy
        location /api/ {
            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_cache_bypass $http_upgrade;
        }

        # Health check
        location /health {
            proxy_pass http://backend:3001/health;
        }
    }
}
```

### Step 2: Build Container Images

```bash
# Build backend image
cd backend
podman build -t ideation-backend:latest .

# Build frontend image
cd ..
podman build -t ideation-frontend:latest .
```

### Step 3: Create Podman Pod

```bash
# Create pod with published ports
podman pod create \
  --name ideation-pod \
  --publish 8080:80 \
  --network bridge

# Get pod ID for later use
POD_ID=$(podman pod ps --filter name=ideation-pod --format "{{.ID}}")
echo "Pod ID: $POD_ID"
```

### Step 4: Run Containers in Pod

```bash
# Run backend container
podman run -d \
  --name ideation-backend \
  --pod ideation-pod \
  --env-file backend/.env.production \
  -e DB_HOST=host.containers.internal \
  --add-host host.containers.internal:host-gateway \
  ideation-backend:latest

# Run frontend container  
podman run -d \
  --name ideation-frontend \
  --pod ideation-pod \
  ideation-frontend:latest

# Verify all containers are running
podman ps --pod
```

### Step 5: Verify Deployment

```bash
# Check pod status
podman pod ps

# Check container logs
podman logs ideation-backend
podman logs ideation-frontend

# Test health endpoint
curl http://localhost:8080/health

# Test API
curl http://localhost:8080/api/sessions
```

---

## Part 5: Network & Firewall Configuration

### Step 1: Configure Firewall

```bash
# Allow HTTP traffic
sudo firewall-cmd --permanent --add-port=8080/tcp

# Or for HTTPS (if you add TLS):
sudo firewall-cmd --permanent --add-port=443/tcp

# Reload firewall
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-ports
```

### Step 2: SELinux Configuration (if needed)

```bash
# If SELinux blocks container connections:
sudo setsebool -P container_manage_cgroup on
sudo setsebool -P container_connect_any on

# Check SELinux status
sestatus
```

---

## Part 6: Production Hardening

### Step 1: Create Systemd Service

Create `/etc/systemd/system/ideation-pod.service`:
```bash
sudo cat > /etc/systemd/system/ideation-pod.service << 'EOF'
[Unit]
Description=Ideation App Podman Pod
Wants=network-online.target postgresql.service
After=network-online.target postgresql.service

[Service]
Type=forking
Restart=always
RestartSec=10
ExecStartPre=/usr/bin/podman pod exists ideation-pod || /usr/bin/podman pod create --name ideation-pod --publish 8080:80
ExecStart=/usr/bin/podman pod start ideation-pod
ExecStop=/usr/bin/podman pod stop ideation-pod
KillMode=control-group

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ideation-pod.service
sudo systemctl start ideation-pod.service
```

### Step 2: Set Up Logging

```bash
# Create log directory
sudo mkdir -p /var/log/ideation

# Configure log rotation
sudo cat > /etc/logrotate.d/ideation << 'EOF'
/var/log/ideation/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
EOF
```

### Step 3: Backups

Create backup script:
```bash
sudo cat > /usr/local/bin/backup-ideation.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/var/backups/ideation
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
sudo -u postgres pg_dump ideation | gzip > $BACKUP_DIR/ideation_$TIMESTAMP.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "ideation_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/ideation_$TIMESTAMP.sql.gz"
EOF

sudo chmod +x /usr/local/bin/backup-ideation.sh
```

Add to crontab:
```bash
sudo crontab -e
# Add line: 0 2 * * * /usr/local/bin/backup-ideation.sh
```

---

## Part 7: SSL/TLS Setup (Optional but Recommended)

### Option 1: Let's Encrypt with Certbot

```bash
# Install certbot
sudo dnf install certbot

# Generate certificate (requires domain name)
sudo certbot certonly --standalone -d your-domain.com

# Certificates will be in /etc/letsencrypt/live/your-domain.com/
```

### Option 2: Self-Signed Certificate

```bash
# Generate self-signed cert
sudo mkdir -p /etc/pki/ideation
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/pki/ideation/key.pem \
  -out /etc/pki/ideation/cert.pem \
  -subj "/CN=your-vm-ip"
```

Update nginx config to use HTTPS:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/pki/ideation/cert.pem;
    ssl_certificate_key /etc/pki/ideation/key.pem;
    # ... rest of config
}
```

---

## Part 8: Monitoring & Maintenance

### Check Pod Status

```bash
# Pod status
podman pod ps

# Container status
podman ps --pod

# Container logs
podman logs -f ideation-backend
podman logs -f ideation-frontend

# Resource usage
podman pod stats ideation-pod
```

### Database Monitoring

```bash
# Active connections
sudo -u postgres psql -d ideation -c "SELECT count(*) FROM pg_stat_activity WHERE datname='ideation';"

# Database size
sudo -u postgres psql -d ideation -c "SELECT pg_size_pretty(pg_database_size('ideation'));"

# Top tables by size
sudo -u postgres psql -d ideation -c "
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Performance Tuning

```bash
# Increase PostgreSQL shared buffers (edit postgresql.conf)
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 16MB

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## Part 9: Updates & Rollbacks

### Deploy New Version

```bash
# 1. Pull latest code
cd /path/to/plausible_futures
git pull

# 2. Rebuild frontend
npm install
npm run build

# 3. Rebuild backend
cd backend
npm install --production

# 4. Rebuild images
podman build -t ideation-backend:latest backend/
podman build -t ideation-frontend:latest .

# 5. Stop old containers
podman stop ideation-backend ideation-frontend

# 6. Remove old containers
podman rm ideation-backend ideation-frontend

# 7. Start new containers
podman run -d --name ideation-backend --pod ideation-pod --env-file backend/.env.production ideation-backend:latest
podman run -d --name ideation-frontend --pod ideation-pod ideation-frontend:latest

# 8. Verify
curl http://localhost:8080/health
```

### Rollback

```bash
# Tag images before deploying
podman tag ideation-backend:latest ideation-backend:v1.0
podman tag ideation-frontend:latest ideation-frontend:v1.0

# To rollback:
podman stop ideation-backend ideation-frontend
podman rm ideation-backend ideation-frontend
podman run -d --name ideation-backend --pod ideation-pod ideation-backend:v1.0
podman run -d --name ideation-frontend --pod ideation-pod ideation-frontend:v1.0
```

---

## Part 10: Troubleshooting

### Backend Won't Connect to PostgreSQL

```bash
# Test connection from container
podman exec -it ideation-backend sh
# Inside container:
nc -zv host.containers.internal 5432
```

### Frontend Can't Reach Backend

```bash
# Check nginx logs
podman logs ideation-frontend

# Test backend directly
curl http://localhost:3001/health
```

### Database Permission Issues

```sql
-- Grant all privileges on existing tables
\c ideation
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ideation_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ideation_app;
```

### Pod Won't Start

```bash
# Remove and recreate pod
podman pod stop ideation-pod
podman pod rm ideation-pod

# Check for port conflicts
sudo netstat -tulpn | grep 8080

# Recreate pod
podman pod create --name ideation-pod --publish 8080:80
```

---

## Part 11: Security Checklist

- [ ] Change default PostgreSQL password
- [ ] Restrict PostgreSQL network access (pg_hba.conf)
- [ ] Enable SSL/TLS for HTTPS
- [ ] Set up firewall rules (only allow 8080/443)
- [ ] Regular database backups (automated)
- [ ] Keep containers updated (security patches)
- [ ] Monitor logs for suspicious activity
- [ ] Implement rate limiting on API endpoints
- [ ] Add JWT authentication (replace localStorage)
- [ ] Set secure session cookies (httpOnly, secure, sameSite)

---

## Part 12: Accessing the Application

Once deployed, users access the app at:
```
http://your-vm-ip:8080
```

Or with domain:
```
https://your-domain.com
```

See `USER_MANUAL.md` for end-user instructions.

