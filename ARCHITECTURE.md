# Oncorad: Project Architecture

## Overview
The Oncorad project follows a modular, feature-based architecture organized as a monorepo-style structure.

```text
oncorad/
├── backend/            # Express Node.js Backend
│   └── src/
│       ├── core/       # Global infrastructure (Database, MQTT, Config)
│       └── modules/    # Functional Packages (Auth, RTLS, IoT, Hospital)
├── frontend/           # Vite + React + TypeScript Frontend
│   └── src/
│       ├── features/   # Reusable UI modules
│       ├── components/ # Shared UI elements
│       └── contexts/   # Global state management
└── package.json        # Root orchestrator
```

## Backend Architecture (Modules)

Each module in `backend/src/modules/` is self-contained and follows the **Route-Controller-Model** pattern:
- **`*.routes.js`**: Defines the HTTP endpoints.
- **`*.controller.js`**: Handles request logic and orchestration.
- **`*.model.js`**: Encapsulates data access and business rules (PostgreSQL/Pool).
- **`*.service.js`**: (Optional) Complex background logic or cross-model operations.

### Feature Modules
- **`auth`**: User management and JWT-based security.
- **`rtls`**: Indoor localization engine using RSSI fingerprinting and WCL.
- **`iot`**: Sub-packaged into `air`, `energy`, `oxygen`, and `sirens`.
- **`hospital`**: Patient admissions, assets (equipment), and medical folder management.
- **`shared`**: Common utilities and the centralized `mqtt-service.js`.

## MQTT Event Flow
The system uses a decoupled **Event Bus** pattern for real-time IoT data:
1. **`core/mqtt`**: Low-level connection management.
2. **`shared/mqtt-service.js`**: High-level message router. It emits events and broadcasts to WebSockets.
3. **Domain Services**: Subscribe to specific topics/events to persist data or trigger alerts.

## Deployment & Development
- **Dev**: `npm run dev` from root (runs both frontend and backend concurrently).
- **Prod**: `npm run pm2:start` (manages the backend via PM2).
- **Build**: `npm run build` (builds the React frontend into `backend/dist`).
