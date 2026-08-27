# ChainSettle — Frontend Repo

> **Next.js 14 frontend for milestone-based supply chain escrow on Stellar**

This is **Repo 3 of 3** in the ChainSettle project:

| Repo | Description |
|------|-------------|
| `chainsetttle-contract` | Soroban smart contract (Rust) |
| `chainsetttle-backend` | NestJS REST API + event poller |
| `chainsettle-frontend` ← you are here | Next.js 14 + Freighter wallet UI |

---

## What This Frontend Does

ChainSettle frontend is the user-facing interface for creating, tracking, and resolving milestone-based shipments through a Stellar escrow contract. It is designed to be simple and secure for all roles in the supply chain.

Key user experiences:

- **Sign-In With Stellar** — authenticate with Freighter, no passwords required.
- **Create shipments** — configure buyer/supplier/logistics/arbiter, define milestone splits, then sign once to lock USDC into Soroban escrow.
- **Track active shipments** — view shipment status, progress, and related chain events.
- **Verify on-chain data** — Stellar addresses and transaction hashes are linked directly to Stellar Expert.
- **Role-driven milestone actions** — suppliers submit proof, buyers confirm delivery, logistics update transit status, and arbiters resolve disputes.
- **Search and filter** — browse shipments by status and by shipment ID or counterparty address.

Every transaction is signed through the user's Freighter wallet. The frontend never stores private keys.

---

## Latest Features

This repo now includes a complete set of UI improvements for the shipment list and shipment creation workflow.

### On-chain verification links

- Added `src/components/StellarLink.tsx`.
- Renders Stellar addresses and transaction hashes as anchor links.
- Uses `NEXT_PUBLIC_STELLAR_NETWORK` to generate the correct Stellar Expert base URL:
  - `testnet` → `https://stellar.expert/explorer/testnet/`
  - `mainnet` → `https://stellar.expert/explorer/public/`
- Address links point to `/account/{address}`.
- Transaction hash links point to `/tx/{hash}`.
- Links open in a new tab using `target="_blank"` and `rel="noopener noreferrer"`.

### Shipment metadata UX

- Updated `src/components/shipments/ShipmentMeta.tsx` to replace raw address/hash text with `StellarLink`.
- Preserves copy-to-clipboard behavior while making chain references instantly clickable.

### Shipment list filtering

- Updated `src/app/dashboard/shipments/page.tsx`.
- Added top tabs for: `All`, `Active`, `Completed`, and `Cancelled`.
- Displays counts for each status in tab labels.
- Highlights the active status tab visually.
- Persists filter state in the URL with `?status=`.
- Maintains compatibility with the search box.
- Fetches status counts from the backend using the existing shipments list API.

### Milestone validation for creation

- Updated `src/app/dashboard/shipments/create/page.tsx`.
- Added a live percentage indicator beneath the milestone section.
- Shows a green success state when milestone percentages sum to `100%`.
- Shows a red warning state when the sum is invalid.
- Disables the submit button unless the milestone split totals exactly `100%`.
- Enforces numeric input between `1` and `100` for each milestone percentage.
- Supports dynamic milestone row add/remove with real-time total recalculation.

These updates improve reliability and reduce contract submission failures by catching invalid milestone splits in the UI.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 14** (App Router) | Framework with server and client components |
| **Tailwind CSS** | Utility-first styling |
| **Zustand** | Lightweight global state (auth, wallet) |
| **@stellar/freighter-api** | Connect to Freighter wallet, sign transactions |
| **@stellar/stellar-sdk** | Build Soroban transactions, interact with RPC |
| **Axios** | HTTP client for backend API calls |
| **date-fns** | Date formatting |
| **lucide-react** | Icon set |

---

## Project Structure

```
chainsettle-frontend/
├── .env.example                        ← copy to .env.local
├── .gitignore
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── README.md
│
└── src/
    ├── middleware.ts                   ← Auth-protect dashboard routes
    │
    ├── app/
    │   ├── layout.tsx                  ← Root layout with metadata and providers
    │   ├── page.tsx                    ← Redirect to /dashboard/shipments
    │   ├── providers.tsx               ← Zustand rehydration wrapper
    │   │
    │   ├── auth/
    │   │   └── login/
    │   │       └── page.tsx            ← Freighter connect + Stellar login page
    │   │
    │   ├── dashboard/
    │   │   ├── layout.tsx              ← Sidebar + top bar wrapper
    │   │   └── shipments/
    │   │       ├── page.tsx            ← Shipments list with tabs + search
    │   │       ├── create/
    │   │       │   └── page.tsx        ← Create shipment form + milestone validation
    │   │       └── [id]/
    │   │           └── page.tsx        ← Shipment detail and milestone timeline
    │   │
    │   └── notifications/
    │       └── page.tsx                ← Notification feed
    │
    ├── components/
    │   ├── StellarLink.tsx             ← Stellar Expert address/tx links
    │   ├── layout/
    │   │   ├── Sidebar.tsx             ← Navigation sidebar
    │   │   └── TopBar.tsx              ← Header with wallet actions
    │   ├── shipments/
    │   │   ├── ShipmentCard.tsx        ← List card UI for shipments
    │   │   ├── ShipmentProgress.tsx    ← Progress bar and totals
    │   │   ├── ShipmentMeta.tsx        ← Shipment metadata details
    │   │   └── ShipmentCardSkeleton.tsx← Loading skeletons
    │   └── milestones/
    │       ├── MilestoneTimeline.tsx   ← Milestone action timeline
    │       └── ArbiterPanel.tsx       ← Dispute resolution UI
    │
    ├── lib/
    │   ├── stellar/
    │   │   ├── freighter.ts            ← Freighter wallet wrappers
    │   │   └── contract.ts             ← Soroban transaction builders
    │   ├── api/
    │   │   ├── client.ts               ← Axios client with auth interceptor
    │   │   └── services.ts             ← Backend API wrappers
    │   ├── hooks/
    │   │   └── use-auth-store.ts       ← Zustand auth store
    │   └── utils/
    │       └── index.ts                ← Formatting and helpers
    │
    ├── types/
    │   └── index.ts                    ← Shared TypeScript types
    │
    └── styles/
        └── globals.css                 ← Tailwind setup and custom styles
```

---

## Internationalization

The frontend uses `next-intl` with English as the default locale. Translation messages live in `src/i18n/messages/en.json`, and supported locales are declared in `src/i18n/config.ts`.

To add a locale:

1. Copy `src/i18n/messages/en.json` to a new file such as `src/i18n/messages/fr.json` and translate its values.
2. Add the locale code to the `locales` array in `src/i18n/config.ts`.
3. Load the new message bundle in `src/app/providers.tsx` and pass the selected locale and messages to `NextIntlClientProvider`.
4. Keep translation keys stable across locale files so components can use the same `useTranslations` calls.

## Key Flows

### Authentication (Sign-In With Stellar)

1. User clicks connect.
2. Freighter returns the public Stellar address.
3. Frontend requests a nonce from `/auth/nonce`.
4. User signs the nonce in Freighter.
5. Frontend sends the signed payload to `/auth/login`.
6. Backend returns a JWT and user profile.
7. Frontend stores auth state and redirects to the dashboard.

### Shipment creation

1. User enters buyer/supplier/logistics/arbiter addresses.
2. User defines milestones and payment percentages.
3. The UI validates that the milestone total equals `100%`.
4. The user signs a Soroban transaction through Freighter.
5. The transaction is published to Stellar.
6. After confirmation, the shipment is stored in the backend.

### Shipment filtering and verification

- Shipment list supports text search and status tabs.
- Status selection persists in the browser URL.
- Shipment metadata includes Stellar Expert links for both accounts and tx hashes.
- Users can verify chain state without manual lookup.

---

## Prerequisites

- **Node.js** v20+
- **Freighter** browser extension installed
- Running backend service (`chainsetttle-backend`)
- Deployed contract with IDs configured in `.env.local`

---

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_STELLAR_NETWORK` | Yes | `testnet` or `mainnet` |
| `NEXT_PUBLIC_CONTRACT_ID` | Yes | Deployed contract ID |
| `NEXT_PUBLIC_USDC_ADDRESS` | Yes | USDC asset address for network |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Yes | Soroban RPC endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | No | Optional Horizon URL |

---

## Production Checklist

- [ ] Set `NEXT_PUBLIC_STELLAR_NETWORK=mainnet`
- [ ] Use mainnet USDC address
- [ ] Configure mainnet contract ID
- [ ] Enable HTTPS backend URL
- [ ] Deploy frontend and backend with matching CORS settings

---

## License

MIT
