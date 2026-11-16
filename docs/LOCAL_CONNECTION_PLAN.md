# Local and external connection plan

## Phase A — local-only
- Node.js 22+
- npm test
- npm run check
- npm start
- open http://localhost:8766/public/
- no external API required
- browser localStorage only for saved inputs
- JSON result export

## Phase B — GitHub
- main is source of truth
- codex/* branches for changes
- CI must pass before merge
- retain commit SHA for later deployment provenance

## Phase C — Cloudflare Preview
Cloudflare is optional. If used later:
- deploy only static public assets first
- use an explicit Cloudflare account alias/account ID
- never guess the account
- keep Preview and Production separate
- no company inputs need to be uploaded for calculation

## Phase D — commercial layer
Stripe is optional and must not affect calculation results:
- TEST before LIVE
- entitlement separated from the decision engine
- Product/Price IDs explicit
- no secrets in GitHub

## Data boundary
The default product remains local-first. Cost, supplier, and capacity inputs are not sent to a server by the v1 UI.
