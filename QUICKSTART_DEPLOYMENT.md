# Quick Start: Production Deployment to RHEL VM

## 🎯 Goal
Deploy the Ideation App to RHEL VM with Podman + PostgreSQL to support 100+ concurrent users.

## ⏱️ Total Time: 5-9 hours

---

## Prerequisites

✅ **Your RHEL VM has:**
- PostgreSQL installed and running
- Podman installed
- Node.js 18+ (for building)
- Git (to clone/pull code)
- Network access (port 8080 or 443 for HTTPS)

---

## Step-by-Step Deployment

### 🗄️ Step 1: Set Up PostgreSQL (30 min)

```bash
# 1. Create database and user
sudo -i -u postgres psql
```

```sql
CREATE DATABASE ideation;
CREATE USER ideation_app WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ideation TO ideation_app;
\c ideation
GRANT ALL ON SCHEMA public TO ideation_app;
\q
```

```bash
# 2. Run schema migration
cd /path/to/plausible_futures
PGPASSWORD='your_password' psql -h localhost -U ideation_app -d ideation -f backend/migrations/001_initial_schema.sql

# 3. Verify
PGPASSWORD='your_password' psql -h localhost -U ideation_app -d ideation -c "\dt"
```

**✅ Expected output:** List of 5 tables (sessions, topics, session_participants, contributions, votes)

---

### 🔄 Step 2: Migrate Backend to PostgreSQL (2-4 hours)

```bash
# 1. Install PostgreSQL driver
cd backend
npm install pg

# 2. Create PostgreSQL database module
cat > db-postgres.js << 'EOF'
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ideation',
  user: process.env.DB_USER || 'ideation_app',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const dbWrapper = {
  prepare: (sql) => ({
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
  }),
  exec: async (sql) => {
    await pool.query(sql);
  }
};

pool.on('connect', () => console.log('✅ PostgreSQL connected'));
pool.on('error', (err) => console.error('❌ PostgreSQL error:', err));

export default dbWrapper;
EOF

# 3. Update route handlers (CRITICAL STEP)
# For EACH route file (sessions.js, contributions.js, votes.js):
# - Add 'async' to route handlers: router.METHOD(path, async (req, res) => {
# - Add 'await' before all db.prepare().get/run/all() calls
# - Add 'await' before all db.exec() calls
# - Wrap in try/catch for error handling

# Example before:
#   const session = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(id);
# 
# Example after:
#   const session = await db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(id);

# 4. Update imports in all route files
sed -i "s/import db from '..\/db.js';/import db from '..\/db-postgres.js';/g" routes/*.js

# 5. Create .env.production
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3001
DB_HOST=host.containers.internal
DB_PORT=5432
DB_NAME=ideation
DB_USER=ideation_app
DB_PASSWORD=your_secure_password
CORS_ORIGIN=http://your-vm-ip:8080
EOF

# 6. Test locally
export $(cat .env.production | xargs)
npm start &

# 7. Verify
curl http://localhost:3001/health
# Expected: {"status":"ok"}

npm test
# Expected: 61 tests passing
```

**⚠️ Detailed checklist in `backend/MIGRATION_CHECKLIST.md`**

---

### 📦 Step 3: Build Application (15 min)

```bash
# 1. Build frontend
cd /path/to/plausible_futures
npm install
npm run build
# Creates dist/ folder

# 2. Prepare backend
cd backend
npm install --production
```

---

### 🐋 Step 4: Create Dockerfiles (15 min)

**Backend Dockerfile:**
```bash
cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "server.js"]
EOF
```

**Frontend Dockerfile:**
```bash
cat > Dockerfile << 'EOF'
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF
```

**Nginx config:**
```bash
cat > nginx.conf << 'EOF'
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    upstream backend {
        server localhost:3001;
    }

    server {
        listen 80;
        server_name _;

        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://localhost:3001;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /health {
            proxy_pass http://localhost:3001/health;
        }
    }
}
EOF
```

---

### 🚀 Step 5: Deploy with Podman (30 min)

```bash
# 1. Build images
cd /path/to/plausible_futures
podman build -t ideation-backend:latest backend/
podman build -t ideation-frontend:latest .

# 2. Create pod
podman pod create --name ideation-pod --publish 8080:80 --network bridge

# 3. Run backend container
podman run -d \
  --name ideation-backend \
  --pod ideation-pod \
  --env-file backend/.env.production \
  -e DB_HOST=host.containers.internal \
  --add-host host.containers.internal:host-gateway \
  ideation-backend:latest

# 4. Run frontend container
podman run -d \
  --name ideation-frontend \
  --pod ideation-pod \
  ideation-frontend:latest

# 5. Verify
podman pod ps
podman ps --pod
curl http://localhost:8080/health
```

**✅ Expected:** Both containers running, health check returns {"status":"ok"}

---

### 🔒 Step 6: Configure Firewall (5 min)

```bash
# Allow HTTP traffic
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports
```

---

### 🔄 Step 7: Set Up Auto-Start (15 min)

```bash
# Create systemd service
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

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable ideation-pod.service
sudo systemctl start ideation-pod.service

# Verify
sudo systemctl status ideation-pod.service
```

---

### 💾 Step 8: Set Up Backups (10 min)

```bash
# Create backup script
sudo cat > /usr/local/bin/backup-ideation.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/var/backups/ideation
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
sudo -u postgres pg_dump ideation | gzip > $BACKUP_DIR/ideation_$TIMESTAMP.sql.gz
find $BACKUP_DIR -name "ideation_*.sql.gz" -mtime +7 -delete
echo "Backup completed: $BACKUP_DIR/ideation_$TIMESTAMP.sql.gz"
EOF

sudo chmod +x /usr/local/bin/backup-ideation.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-ideation.sh
```

---

### 🔐 Step 9: SSL/TLS (Optional, 30 min)

**Option A: Self-signed cert (for internal use):**
```bash
sudo mkdir -p /etc/pki/ideation
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/pki/ideation/key.pem \
  -out /etc/pki/ideation/cert.pem \
  -subj "/CN=your-vm-hostname"

# Update nginx.conf to listen on 443 with SSL
# Rebuild and redeploy frontend container
```

**Option B: Let's Encrypt (for public access):**
```bash
sudo dnf install certbot
sudo certbot certonly --standalone -d your-domain.com
# Certs in /etc/letsencrypt/live/your-domain.com/
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] PostgreSQL is running: `sudo systemctl status postgresql`
- [ ] Tables exist: `psql -U ideation_app -d ideation -c "\dt"`
- [ ] Pod is running: `podman pod ps`
- [ ] Containers are healthy: `podman ps --pod`
- [ ] Health endpoint works: `curl http://localhost:8080/health`
- [ ] Frontend loads: Open `http://your-vm-ip:8080` in browser
- [ ] Can sign up and sign in
- [ ] Can create session (moderator)
- [ ] Can join session (participant)
- [ ] Firewall allows external access: `sudo firewall-cmd --list-ports`
- [ ] Auto-start enabled: `sudo systemctl is-enabled ideation-pod.service`
- [ ] Backup script works: `sudo /usr/local/bin/backup-ideation.sh`

---

## 🎓 User Onboarding

Share `USER_MANUAL.md` with your team!

**Quick training:**
1. Show moderators how to create sessions
2. Walk through contribution workflow
3. Demonstrate voting process
4. Show report download

---

## 📊 Monitor Performance

```bash
# Container stats
podman pod stats ideation-pod

# Database connections
sudo -u postgres psql -d ideation -c "SELECT count(*) FROM pg_stat_activity WHERE datname='ideation';"

# Database size
sudo -u postgres psql -d ideation -c "SELECT pg_size_pretty(pg_database_size('ideation'));"

# Logs
podman logs -f ideation-backend
podman logs -f ideation-frontend
```

---

## 🆘 Troubleshooting

### Backend can't connect to PostgreSQL
```bash
# From container:
podman exec -it ideation-backend sh
nc -zv host.containers.internal 5432

# Check pg_hba.conf allows connections
sudo cat /var/lib/pgsql/data/pg_hba.conf | grep ideation
```

### Pod won't start
```bash
# Check port conflicts
sudo netstat -tulpn | grep 8080

# Remove and recreate
podman pod stop ideation-pod
podman pod rm ideation-pod
# Re-run Step 5
```

### Frontend can't reach backend
```bash
# Test backend directly
curl http://localhost:3001/health

# Check nginx logs
podman logs ideation-frontend
```

---

## 📚 Full Documentation

- **Complete deployment guide**: `DEPLOYMENT.md`
- **PostgreSQL migration details**: `backend/MIGRATION_CHECKLIST.md`
- **End-user guide**: `USER_MANUAL.md`
- **Architecture details**: `design.md`
- **Development plan**: `plan.md`

---

## 🚀 You're Live!

**Access your app at:** `http://your-vm-ip:8080`

**Next:** Share the session ID with participants and start your first collaborative ideation session!

