# PRM Portal — Architecture Diagrams

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        REACT[React SPA]
    end

    subgraph "API Layer"
        NGINX[NGINX / Reverse Proxy]
        API[Express.js API Server]
        RATE[Rate Limiter<br>redis-based]
    end

    subgraph "Auth"
        JWT[JWT Middleware]
        RBAC[RBAC / Scope Middleware]
    end

    subgraph "Business Logic Layer"
        DEALS[Deal Service]
        QUOTES[Quote / CPQ Service]
        LEADS[Lead Service]
        MDF[MDF Service]
        TIERS[Tier Service]
        NOTIF[Notification Service]
        DOCS[Document Service]
    end

    subgraph "Background Jobs"
        BULL[Bull Queue<br>Redis-backed]
        CRON[node-cron Scheduler]
        WORKERS[Job Workers]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        REDIS[(Redis<br>Cache + Sessions + Queues)]
        S3[S3 / MinIO<br>File Storage]
    end

    subgraph "External"
        EMAIL[Email Service<br>SendGrid / SES]
        PDF[PDF Generator<br>Puppeteer / wkhtmltopdf]
    end

    REACT --> NGINX
    NGINX --> API
    API --> RATE
    API --> JWT --> RBAC
    RBAC --> DEALS & QUOTES & LEADS & MDF & TIERS & NOTIF & DOCS
    DEALS & QUOTES & LEADS & MDF & TIERS --> PG
    DEALS & QUOTES & LEADS --> BULL
    NOTIF --> EMAIL
    NOTIF --> REDIS
    BULL --> WORKERS
    WORKERS --> PG & EMAIL & REDIS
    CRON --> BULL
    DOCS --> S3
    QUOTES --> PDF
```

## Entity Relationship Overview

```mermaid
erDiagram
    PARTNER_TIERS ||--o{ ORGANIZATIONS : "assigned tier"
    ORGANIZATIONS ||--o{ USERS : "has members"
    ORGANIZATIONS ||--o{ DEALS : "registers"
    ORGANIZATIONS ||--o{ QUOTES : "creates"
    ORGANIZATIONS ||--o{ LEADS : "receives"
    ORGANIZATIONS ||--o{ MDF_ALLOCATIONS : "receives budget"

    USERS ||--o{ DEALS : "submits"
    USERS ||--o{ QUOTES : "creates"
    USERS ||--o{ LEADS : "works"
    USERS ||--o{ USER_CERTIFICATIONS : "earns"
    USERS ||--o{ NOTIFICATIONS : "receives"

    DEALS ||--o{ DEAL_PRODUCTS : "includes"
    DEALS ||--o{ DEAL_STATUS_HISTORY : "tracks"
    DEALS ||--o{ QUOTES : "generates"

    QUOTES ||--o{ QUOTE_LINE_ITEMS : "contains"

    PRODUCTS ||--o{ DEAL_PRODUCTS : "referenced in"
    PRODUCTS ||--o{ QUOTE_LINE_ITEMS : "priced in"
    PRODUCTS ||--o{ TIER_PRODUCT_PRICING : "has tier pricing"
    PRODUCT_CATEGORIES ||--o{ PRODUCTS : "categorizes"

    MDF_ALLOCATIONS ||--o{ MDF_REQUESTS : "funds"
    COURSES ||--o{ USER_CERTIFICATIONS : "certifies"
    DOCUMENT_FOLDERS ||--o{ DOCUMENTS : "contains"
```

## Deal Registration State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> Submitted: Partner submits
    Submitted --> Under_Review: CM picks up
    Submitted --> Rejected: Auto-reject (policy)
    Under_Review --> Approved: CM approves
    Under_Review --> Rejected: CM rejects
    Approved --> Won: Partner closes deal
    Approved --> Lost: Deal lost
    Approved --> Expired: 90-day window expires
    Rejected --> Draft: Partner revises
    Won --> [*]
    Lost --> [*]
    Expired --> [*]
```

## Quote Approval Flow

```mermaid
flowchart TD
    A[Partner creates quote] --> B{Any line discount > self-approve threshold?}
    B -->|No| C[Auto-approved, can send to customer]
    B -->|Yes| D{Discount level?}
    D -->|Within CM range| E[Route to Channel Manager]
    D -->|Above CM range| F[Route to Admin/VP]
    E --> G{CM Decision}
    G -->|Approve| C
    G -->|Reject| H[Return to partner with notes]
    G -->|Request changes| H
    F --> I{Admin Decision}
    I -->|Approve| C
    I -->|Reject| H
    H --> A
    C --> J[Generate PDF]
    J --> K[Send to customer]
```

## Lead Distribution Flow

```mermaid
flowchart TD
    A[New lead enters system] --> B[Score lead 0-100]
    B --> C{Score >= 50?}
    C -->|No| D[Park in unassigned pool]
    C -->|Yes| E[Select partner org]
    E --> F{Assignment criteria}
    F --> G[Tier priority<br>higher tier = first pick]
    F --> H[Geographic match]
    F --> I[Industry expertise]
    F --> J[Current lead load<br>fairness balancing]
    G & H & I & J --> K[Assign to org]
    K --> L[Set SLA deadline<br>48h to accept]
    L --> M{Partner responds?}
    M -->|Accept| N[Partner works lead]
    M -->|Return| O[Re-queue for assignment]
    M -->|SLA expires| O
    N --> P{Outcome}
    P -->|Convert| Q[Create Deal Registration]
    P -->|Disqualify| R[Log reason, close]
```

## Project Structure

```
prm-portal/
├── src/
│   ├── config/
│   │   ├── database.js          # Knex/pg pool config
│   │   ├── redis.js             # Redis client
│   │   ├── auth.js              # JWT secrets, expiry
│   │   └── constants.js         # Enums, limits, defaults
│   ├── middleware/
│   │   ├── authenticate.js      # JWT verification
│   │   ├── authorize.js         # Role-based guard
│   │   ├── scopeToOrg.js        # Partner data scoping
│   │   ├── rateLimiter.js       # Redis-backed rate limiting
│   │   ├── validate.js          # Joi/Zod schema validation
│   │   ├── errorHandler.js      # Global error handler
│   │   └── activityLogger.js    # Auto-log to activity_feed
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── organizations.routes.js
│   │   ├── tiers.routes.js
│   │   ├── deals.routes.js
│   │   ├── products.routes.js
│   │   ├── quotes.routes.js
│   │   ├── leads.routes.js
│   │   ├── mdf.routes.js
│   │   ├── courses.routes.js
│   │   ├── documents.routes.js
│   │   ├── notifications.routes.js
│   │   └── dashboard.routes.js
│   ├── controllers/             # Thin controllers (parse request, call service, send response)
│   │   └── [mirrors routes]
│   ├── services/                # Business logic layer
│   │   ├── auth.service.js
│   │   ├── deal.service.js      # includes conflict detection
│   │   ├── quote.service.js     # includes discount evaluation
│   │   ├── lead.service.js      # includes assignment logic
│   │   ├── mdf.service.js       # includes allocation rules
│   │   ├── tier.service.js      # includes auto-calculation
│   │   ├── notification.service.js
│   │   └── activity.service.js
│   ├── repositories/            # Data access layer (SQL queries)
│   │   └── [mirrors services]
│   ├── jobs/                    # Background job processors
│   │   ├── queue.js             # Bull queue setup
│   │   ├── tierRecalculation.job.js
│   │   ├── dealExpiration.job.js
│   │   ├── leadSlaCheck.job.js
│   │   ├── certExpiryWarning.job.js
│   │   ├── mdfDeadlineCheck.job.js
│   │   └── metricsRollup.job.js
│   ├── utils/
│   │   ├── AppError.js          # Custom error class
│   │   ├── pagination.js        # Cursor/offset pagination helpers
│   │   ├── filters.js           # Query param -> SQL WHERE builder
│   │   └── numberGenerator.js   # Deal/quote/lead number generation
│   ├── validators/              # Joi/Zod schemas per entity
│   │   └── [per entity]
│   └── app.js                   # Express app setup
├── migrations/                  # Knex migration files
├── seeds/                       # Seed data (tiers, sample products)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/                        # This documentation
├── .env.example
├── knexfile.js
└── package.json
```
