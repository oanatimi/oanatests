# Client Management System with SMS Integration

A full-stack application for managing clients and sending SMS messages via Traccar SMS Gateway. Built with Next.js, Express, TypeScript, PostgreSQL, and designed for deployment on Railway.

## 📸 Screenshots

### Desktop Views

| Dashboard | Clients |
|-----------|---------|
| ![Dashboard Desktop](https://github.com/user-attachments/assets/029326fe-4a15-43b9-aa6a-fa00c681f050) | ![Clients Desktop](https://github.com/user-attachments/assets/58eab582-9c02-42f5-81bb-7c61597cefb7) |

| Messages | Templates |
|----------|-----------|
| ![Messages Desktop](https://github.com/user-attachments/assets/99541114-b0e1-4690-9bd2-bfda1946e0a8) | ![Templates Desktop](https://github.com/user-attachments/assets/2ad4c9e8-bfa4-4b9a-935a-daa0beacefdf) |

| Import Data | Settings |
|-------------|----------|
| ![Import Desktop](https://github.com/user-attachments/assets/fe337b22-25eb-4f24-8eff-c7de722bc383) | ![Settings Desktop](https://github.com/user-attachments/assets/30f48ee6-e8ea-4fc6-86f2-2f3b9e46428d) |

### Mobile Views

| Dashboard | Clients | Settings |
|-----------|---------|----------|
| ![Dashboard Mobile](https://github.com/user-attachments/assets/a1cd80ee-a4da-4c68-840c-19bc9968f361) | ![Clients Mobile](https://github.com/user-attachments/assets/60cfd22d-7725-45a4-9337-3adb3a797e57) | ![Settings Mobile](https://github.com/user-attachments/assets/c1ce2ae2-3e8a-4a1d-aab5-80cec6a2c7e5) |

## ✨ Features

### Client Management
- **Excel Import**: Import clients from Excel files (.xlsx) with automatic column mapping
- **Client Categories**: Automatic categorization based on Excel sheet names (Construcții, Agricultură, Comerț Lemn, General)
- **Full Data Persistence**: All Excel data preserved including observations, contact person, contact date
- **Search & Filter**: Search clients by name, phone, email; filter by county and category
- **Client Details**: View comprehensive client information including contact details, company info, and message history
- **Bulk Selection**: Select multiple clients for bulk operations
- **Pagination**: Efficient loading with 20 clients per page

### SMS Messaging
- **Traccar SMS Gateway Integration**: Send SMS via Traccar SMS Gateway
- **Cloudflare Tunnel Support**: Connect to your local Traccar instance via Cloudflare tunnel
- **Bulk Messaging**: Send messages to multiple clients at once
- **Message Templates**: Create and reuse message templates
- **Message History**: Track all sent messages per client

### Queue System
- **Automatic Retry**: Failed messages are automatically retried with exponential backoff
- **Dead Letter Queue**: Messages that exceed retry limits are moved to dead letter queue
- **Real-time Status**: Monitor queue status in real-time

### SMS Best Practices (Anti-Ban Protection)
- **Rate Limiting**: Configurable messages per minute/hour limits
- **Sending Hours**: Only send SMS during business hours (configurable)
- **Recipient Limits**: Daily and weekly limits per recipient
- **Cooldown Period**: Enforced cooldown between messages to same recipient
- **Duplicate Prevention**: Prevents sending duplicate messages
- **Opt-Out Support**: Recipients can opt out by replying with a keyword
- **Message Validation**: Content length and spam pattern detection
- **Phone Number Normalization**: Configurable country code (default +40 for Romania)

### User Experience
- **User-Friendly Error Messages**: Clear, actionable error descriptions instead of technical codes
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Template Selection**: Choose and edit templates when sending messages
- **Real-time Feedback**: Immediate success/error notifications

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│   (Next.js)     │     │   (Express)     │     │    Database     │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │
                        ┌────────▼────────┐
                        │                 │
                        │  Traccar SMS    │
                        │    Gateway      │
                        │  (Cloudflare)   │
                        │                 │
                        └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Traccar SMS Gateway (on your phone)
- Cloudflare Tunnel (optional, for remote access)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/oanatimi/oanatests.git
   cd oanatests
   ```

2. **Set up the Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   npm install
   npx prisma generate
   npx prisma migrate dev
   npm run dev
   ```

3. **Set up the Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your configuration
   npm install
   npm run dev
   ```

4. **Import clients from Excel files**
   - Place your Excel files in the configured data directory
   - Navigate to "Import Data" in the UI
   - Click "Start Import"

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## ⚙️ Environment Variables

### Backend (.env)

```bash
# ===========================================
# DATABASE CONFIGURATION
# ===========================================
DATABASE_URL="postgresql://postgres:password@localhost:5432/client_management?schema=public"

# ===========================================
# SERVER CONFIGURATION
# ===========================================
PORT=3001
NODE_ENV=development

# ===========================================
# TRACCAR SMS GATEWAY CONFIGURATION
# ===========================================
# Direct URL to Traccar SMS Gateway
TRACCAR_SMS_URL=http://localhost:5055
# Device ID registered in Traccar
TRACCAR_SMS_DEVICE_ID=your_device_id
# API token for authentication
TRACCAR_API_TOKEN=your_api_token_here

# ===========================================
# CLOUDFLARE TUNNEL CONFIGURATION
# ===========================================
# Public URL from Cloudflare tunnel (overrides TRACCAR_SMS_URL if set)
CLOUDFLARE_TUNNEL_URL=https://your-tunnel-url.trycloudflare.com

# ===========================================
# RATE LIMITING CONFIGURATION
# ===========================================
SMS_RATE_LIMIT_PER_MINUTE=30
SMS_RATE_LIMIT_PER_HOUR=500
SMS_MAX_RETRIES=5
SMS_RETRY_DELAY_MS=60000
API_RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW_MINUTES=15

# ===========================================
# SMS BEST PRACTICES CONFIGURATION
# ===========================================
SMS_MAX_PER_RECIPIENT_PER_DAY=3
SMS_MAX_PER_RECIPIENT_PER_WEEK=10
SMS_RECIPIENT_COOLDOWN_HOURS=4
SMS_ALLOWED_START_HOUR=9
SMS_ALLOWED_END_HOUR=20
SMS_TIMEZONE=Europe/Bucharest
SMS_MAX_LENGTH=480
SMS_PREVENT_DUPLICATES=true
SMS_DUPLICATE_WINDOW_HOURS=24
SMS_SENDER_NAME=YourCompany
SMS_OPT_OUT_KEYWORD=STOP
SMS_REQUIRE_OPT_OUT_INFO=true

# ===========================================
# OTHER CONFIGURATION
# ===========================================
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
EXCEL_DATA_DIRECTORY=./data
QUEUE_PROCESS_INTERVAL_MS=5000
QUEUE_BATCH_SIZE=10
```

### Frontend (.env)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 🚂 Railway Deployment

### One-Click Deploy

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL database
3. Connect your GitHub repository
4. Add the following environment variables:
   - All backend environment variables listed above
   - `DATABASE_URL` (automatically provided by Railway PostgreSQL)

### Manual Setup

1. **Create a Railway project**
   ```bash
   railway init
   ```

2. **Add PostgreSQL**
   ```bash
   railway add
   # Select PostgreSQL
   ```

3. **Deploy**
   ```bash
   railway up
   ```

## 📱 Traccar SMS Gateway Setup

1. **Install Traccar SMS Gateway** on your Android phone from Google Play Store

2. **Configure the app**:
   - Set a device ID (you'll use this in `TRACCAR_SMS_DEVICE_ID`)
   - Configure the server URL (your backend URL or Cloudflare tunnel)

3. **Cloudflare Tunnel Setup** (for remote access):
   ```bash
   # On your computer
   cloudflared tunnel --url http://localhost:5055
   ```
   This will give you a public URL like `https://xxx.trycloudflare.com`

4. **Configure environment**:
   - Set `CLOUDFLARE_TUNNEL_URL` to the Cloudflare tunnel URL
   - Ensure your phone and computer are on the same network

## 📊 Database Schema

```prisma
model Client {
  id                String    @id @default(uuid())
  companyName       String
  status            String?
  cui               String?
  county            String?
  phonePrimary      String?
  emailPrimary      String?
  administrator     String?
  messages          Message[]
  // ... more fields
}

model Message {
  id          String        @id @default(uuid())
  clientId    String
  phoneNumber String
  content     String
  status      MessageStatus
  sentAt      DateTime?
  retryCount  Int
  client      Client        @relation(...)
}

model MessageQueue {
  id          String      @id @default(uuid())
  messageId   String      @unique
  status      QueueStatus
  attempts    Int
  nextRetry   DateTime
  // ... more fields
}

model OptOut {
  id          String   @id @default(uuid())
  phoneNumber String   @unique
  createdAt   DateTime
}
```

## 🔒 SMS Best Practices

To avoid getting banned by SMS providers:

| Feature | Description | Configuration |
|---------|-------------|---------------|
| **Rate Limiting** | Limits messages per minute/hour | `SMS_RATE_LIMIT_PER_MINUTE`, `SMS_RATE_LIMIT_PER_HOUR` |
| **Sending Hours** | Only send during business hours | `SMS_ALLOWED_START_HOUR`, `SMS_ALLOWED_END_HOUR` |
| **Daily Limits** | Max messages per recipient per day | `SMS_MAX_PER_RECIPIENT_PER_DAY` |
| **Weekly Limits** | Max messages per recipient per week | `SMS_MAX_PER_RECIPIENT_PER_WEEK` |
| **Cooldown** | Time between messages to same recipient | `SMS_RECIPIENT_COOLDOWN_HOURS` |
| **Duplicate Prevention** | Prevent same message to same recipient | `SMS_PREVENT_DUPLICATES` |
| **Opt-Out** | Recipients can unsubscribe | `SMS_OPT_OUT_KEYWORD` |
| **Sender ID** | Identify your company in messages | `SMS_SENDER_NAME` |

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   │   ├── excelParser.ts
│   │   │   ├── smsService.ts
│   │   │   ├── messageQueueService.ts
│   │   │   └── smsValidationService.ts
│   │   └── utils/          # Utilities
│   ├── prisma/             # Database schema
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages
│   │   │   ├── clients/
│   │   │   ├── messages/
│   │   │   ├── templates/
│   │   │   ├── import/
│   │   │   └── settings/
│   │   ├── components/     # React components
│   │   └── lib/            # API client
│   ├── Dockerfile
│   └── package.json
├── docs/
│   └── screenshots/        # UI screenshots
├── docker-compose.yml
├── railway.json
└── README.md
```

## 🛠️ API Endpoints

### Clients
- `GET /api/clients` - List clients (paginated, searchable)
- `GET /api/clients/:id` - Get client details with messages
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client
- `GET /api/clients/counties` - List distinct counties

### Messages
- `GET /api/messages` - List messages (paginated, filterable)
- `POST /api/messages/send` - Send message to single client
- `POST /api/messages/bulk` - Send bulk messages
- `GET /api/messages/queue/status` - Get queue status
- `POST /api/messages/queue/retry-dead-letters` - Retry failed messages

### Templates
- `GET /api/messages/templates` - List templates
- `POST /api/messages/templates` - Create template
- `PUT /api/messages/templates/:id` - Update template
- `DELETE /api/messages/templates/:id` - Delete template

### Import
- `POST /api/import/clients` - Import clients from Excel

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.