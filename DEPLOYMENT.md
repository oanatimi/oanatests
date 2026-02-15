# 🚀 Deployment Guide

## Pre-Push Checklist

Înainte de a face push pe GitHub, verifică:

- [ ] ✅ `.env` este în `.gitignore` (nu se commitează)
- [ ] ✅ Credențialele din `application.properties` sunt înlocuite cu variabile environment
- [ ] ✅ Token-ul Traccar este removet din fișiere publice
- [ ] ✅ Password-ul DB este removet din fișiere publice
- [ ] ✅ README.md este up-to-date
- [ ] ✅ `.env.example` conține toate variabilele necesare
- [ ] ✅ Codul compilează fără erori: `cd backend && npm run build`
- [ ] ✅ Frontend build-uiește: `cd frontend && npm run build`

## GitHub Push - Step by Step

### 1. Initialize Git (dacă nu e deja initialized)

```bash
cd C:\programs\oaza\oanatests

# Initialize Git
git init

# Add remote repository
git remote add origin https://github.com/your-username/oanatests.git
```

### 2. Stage Files

```bash
# Add all files (exclude va fi gestionat de .gitignore)
git add .

# Verifică ce fișiere vor fi committed
git status
```

**IMPORTANT**: Verifică că **NU** apar:
- ❌ `.env`
- ❌ `node_modules/` folder
- ❌ `dist/`
- ❌ `.next/`
- ❌ `*.log` files

### 3. Commit Changes

```bash
git commit -m "Initial commit: Client Management System

Features:
- Backend Express/TypeScript with REST API
- Frontend Next.js + React + TypeScript
- SMS notifications via Traccar
- Client management with Excel import
- Message queue with automatic retry
- Rate limiting and anti-spam protection
"
```

### 4. Push to GitHub

```bash
# Push to main branch
git push -u origin main

# Or if using master branch
git push -u origin master
```

## Create GitHub Repository

1. **Mergi pe GitHub**: https://github.com/new

2. **Completează**:
   - Repository name: `oanatests`
   - Description: "Sistema completa de management pentru clienti cu SMS integration"
   - Visibility: **Private** (recomandat pentru credențiale)
   - ❌ **NU** inițializa cu README (avem deja unul)

3. **Copiază URL-ul** repository-ului:
   ```
   https://github.com/your-username/oanatests.git
   ```

4. **Conectează local repository**:
   ```bash
   git remote add origin https://github.com/your-username/oanatests.git
   git branch -M main
   git push -u origin main
   ```

## Post-Push Setup (pe alt PC/server)

### 1. Clone Repository

```bash
git clone https://github.com/your-username/oanatests.git
cd oanatests
```

### 2. Setup Environment

```bash
# Copiază template-ul
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Editează cu valorile tale REALE
nano backend/.env
nano frontend/.env
```

**Completează cu valorile TALE**:
```env
DB_PASSWORD=your_actual_password
TRACCAR_SMS_GATEWAY_TOKEN=your_actual_token
```

### 3. Setup Database

```sql
CREATE DATABASE client_management;
CREATE USER service WITH PASSWORD 'your_actual_password';
GRANT ALL PRIVILEGES ON DATABASE client_management TO service;
```

### 4. Run Application

```bash
# Backend
cd backend
npm install
npm run db:migrate
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables for Production

### Option 1: System Environment Variables (Windows)

```cmd
setx DB_PASSWORD "your_password"
setx TRACCAR_SMS_GATEWAY_TOKEN "your_token"
```

### Option 2: Docker Environment File

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - DB_PASSWORD=${DB_PASSWORD}
      - TRACCAR_SMS_GATEWAY_TOKEN=${TRACCAR_SMS_GATEWAY_TOKEN}
    env_file:
      - .env
```

### Option 3: Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: oanatests-secrets
type: Opaque
data:
  db-password: <base64-encoded>
  traccar-token: <base64-encoded>
```

## Security Best Practices

### ✅ DO:
- Use environment variables for credentials
- Keep `.env` in `.gitignore`
- Use different credentials for dev/prod
- Enable GitHub's secret scanning
- Review commits before pushing
- Use SSH keys for GitHub authentication

### ❌ DON'T:
- Commit `.env` files
- Hardcode passwords in code
- Share credentials in commits
- Use same password for all environments
- Commit `application-local.properties`

## Rollback Sensitive Data (dacă a fost commituit din greșeală)

Dacă ai commituit credențiale din greșeală:

```bash
# Remove file from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - only if haven't shared)
git push origin --force --all

# Better: Rotate credentials immediately!
# 1. Change DB password
# 2. Regenerate Traccar token
# 3. Update .env with new values
```

## CI/CD Integration (Future)

### GitHub Actions Example

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: client_management
          POSTGRES_USER: service
          POSTGRES_PASSWORD: ${{ secrets.DB_PASSWORD }}
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Build Backend
        run: |
          cd backend
          npm ci
          npm run build
          
      - name: Build Frontend
        run: |
          cd frontend
          npm ci
          npm run build
```

## Maintenance

### Update Dependencies

```bash
# Backend
cd backend
npm outdated
npm update

# Frontend
cd frontend
npm outdated
npm update
```

### Sync Fork (dacă e forked)

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Support

Pentru întrebări despre deployment:
- GitHub Issues: https://github.com/your-username/oanatests/issues
- Email: support@oaza.ro

---

**Last Updated**: January 31, 2026
