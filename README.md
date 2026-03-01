# Private Key Manager

A private, password-protected web app for securely managing API keys and account credentials. All sensitive data is **encrypted client-side with AES-256** before being sent to the server. Installable as a **Progressive Web App (PWA)** on iOS, Android, and Desktop.

## Features

- **AES-256-GCM encryption** – API keys and passwords never leave your device in plaintext
- **Single-user** – designed for personal use
- **Auto-lock** – configurable inactivity timer
- **Password Generator** – built-in with strength indicator
- **Categories & Tags** – organize your entries
- **Search & Filter** – search across all fields
- **Export / Import** – portable encrypted JSON backups
- **PWA** – installable on any device, offline-capable

---

## Requirements

- Docker & Docker Compose v2+
- A server/VPS with a domain name (for HTTPS)
- Port 80 and 443 open

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd private-key-and-account-manager

# 2. Install dependencies
make install

# 3. Set up the database
cp .env.example .env
# Edit .env with your local settings
cd backend && npx prisma migrate dev && cd ..

# 4. Start development servers
make dev
# App runs on http://localhost:5173
```

---

## Production Deployment (Docker)

### Step 1: Prepare your server

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt-get install docker-compose-plugin
```

### Step 2: Configure environment variables

```bash
cp .env.example .env
nano .env
```

Required variables:

```env
# Database
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_USER=pkm_user
POSTGRES_DB=pkm_db

# JWT Secrets (generate: openssl rand -hex 64)
JWT_ACCESS_SECRET=<64-char-random-hex>
JWT_REFRESH_SECRET=<64-char-random-hex>

# Domain
ALLOWED_ORIGINS=https://yourdomain.com
DOMAIN=yourdomain.com
```

### Step 3: HTTPS with Let's Encrypt

```bash
# Update nginx config with your domain
sed -i 's/${DOMAIN}/yourdomain.com/g' nginx-proxy.conf

# Issue SSL certificate
docker run --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot certonly \
  --webroot -w /var/www/certbot \
  -d yourdomain.com \
  --email your@email.com \
  --agree-tos --non-interactive
```

### Step 4: Launch

```bash
docker compose up --build -d
docker compose ps       # Check status
docker compose logs -f  # View logs
```

### Step 5: First-time setup

1. Navigate to `https://yourdomain.com`
2. Create your account (email + master password)
3. **The master password cannot be recovered if lost**

---

## Updating

```bash
git pull && docker compose up --build -d
```

---

## Backup

### Database
```bash
docker compose exec db pg_dump -U pkm_user pkm_db > backup_$(date +%Y%m%d).sql
```

### Encrypted JSON export
Settings → Data Management → Export Encrypted

---

## Architecture

```
Browser (PWA)
└── AES-256-GCM encryption (Web Crypto API)
    └── HTTPS
        └── Nginx Reverse Proxy
            ├── Frontend (React SPA via Nginx)
            └── Backend (Node.js + Express)
                └── PostgreSQL (encrypted data)
```

### Security Model

| Data               | Storage       | Protection                   |
|--------------------|---------------|------------------------------|
| API Keys/Passwords | Encrypted     | AES-256-GCM, client-side     |
| Encryption Key     | Never stored  | Derived from master password |
| Master Password    | Server (hash) | bcrypt cost factor 12        |
| Sessions           | HttpOnly      | Refresh token cookie         |
| Transport          | HTTPS only    | TLS 1.2+                     |

---

## Commands

```bash
make install      # Install all dependencies
make dev          # Start dev servers  
make test         # Run backend tests
make build        # Build for production
make docker       # Start with Docker Compose
make db-migrate   # Run database migrations
make db-studio    # Open Prisma Studio
make clean        # Remove build artifacts
```
