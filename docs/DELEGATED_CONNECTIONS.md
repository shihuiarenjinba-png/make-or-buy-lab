# Delegated connection base

## Goal

The operator should not have to manually re-enter Cloudflare, Stripe, webhook, Google OAuth, or session credentials for every AI/Codex run.

The connection model therefore has two layers:

1. **Central secret vault on the local PC**
2. **Per-repository non-secret service registry**

The AI/script receives only the service and target environment. It resolves the correct Cloudflare account/project and TEST/LIVE credentials automatically.

## 1. Central local master.env

Default path:

`%USERPROFILE%\.decision-ops\master.env`

Override with:

`DECISION_OPS_MASTER_ENV`

The real file is never committed to Git.

Create it once:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\init_master_env.ps1
```

Then fill the generated file once.

### Cloudflare

```dotenv
CF_DEMANDSCOPE_ACCOUNT_ID=
CF_DEMANDSCOPE_API_TOKEN=

CF_DATA_SHAPER_ACCOUNT_ID=
CF_DATA_SHAPER_API_TOKEN=
```

Use a separate token per Cloudflare account/profile. Do not use one global token for every account.

### Stripe

```dotenv
STRIPE_DEMANDSCOPE_TEST_SECRET_KEY=
STRIPE_DEMANDSCOPE_TEST_WEBHOOK_SECRET=
STRIPE_DEMANDSCOPE_TEST_PUBLISHABLE_KEY=

STRIPE_DEMANDSCOPE_LIVE_SECRET_KEY=
STRIPE_DEMANDSCOPE_LIVE_WEBHOOK_SECRET=
STRIPE_DEMANDSCOPE_LIVE_PUBLISHABLE_KEY=
```

TEST and LIVE are stored simultaneously. The user should not have to swap values manually.

### Google identity

```dotenv
GOOGLE_DEMANDSCOPE_PREVIEW_CLIENT_ID=
GOOGLE_DEMANDSCOPE_PREVIEW_CLIENT_SECRET=
GOOGLE_DEMANDSCOPE_PRODUCTION_CLIENT_ID=
GOOGLE_DEMANDSCOPE_PRODUCTION_CLIENT_SECRET=
```

### App session

```dotenv
APP_SESSION_SECRET_PREVIEW=
APP_SESSION_SECRET_PRODUCTION=
```

Add new provider keys to the same central vault using a provider/service prefix.

## 2. Per-repository service-registry.json

Committed file:

`config/service-registry.json`

This file contains no secret values. It defines:

- service_id
- Cloudflare account alias
- which master.env key contains the exact Cloudflare account ID
- which master.env key contains the API token
- Preview Pages project
- Production Pages project
- Preview/Production branch
- Preview => billing TEST
- Production => billing LIVE
- runtime secret source mapping

The repository therefore never guesses which Cloudflare account it belongs to.

## Automatic environment selection

### Preview

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\delegate_connection.ps1 -Environment preview -Action materialize
```

This resolves:

- Preview Cloudflare project
- TEST Stripe keys
- TEST webhook secret
- Preview Google OAuth credentials
- Preview session secret
- `BILLING_MODE=test`

### Production

```powershell
PowerShell -ExecutionPolicy Bypass -File .\scripts\delegate_connection.ps1 -Environment production -Action materialize
```

This resolves:

- Production Cloudflare project
- LIVE Stripe keys
- LIVE webhook secret
- Production Google OAuth credentials
- Production session secret
- `BILLING_MODE=live`

No manual TEST/LIVE key swapping is required.

## Generated local files

The script creates:

- `.env.preview.local` or `.env.production.local`
- `.dev.vars.preview` or `.dev.vars.production`

These files are Git-ignored.

The Cloudflare API token is used by the deployment wrapper. Runtime provider secrets are placed in the environment-specific dev-vars file and can be synchronized to Cloudflare.

Cloudflare supports environment-specific dotenv/dev-vars files and advises that secret files must not be committed. citeturn214823search0turn214823search4

## Safety / account routing

Before any Cloudflare write, the script calls the Cloudflare API using the selected token and exact account ID.

A write is blocked if:

- account ID is missing
- token is missing
- token cannot access that exact account
- project does not match the registry
- Production was selected without `-AllowProduction`
- a write action was requested without `-Apply`

This prevents an AI from choosing a Cloudflare account by name or guess.

## Commands for AI delegation

Read-only diagnosis:

```powershell
.\scripts\delegate_connection.ps1 -Environment preview -Action doctor
```

Materialize local environment:

```powershell
.\scripts\delegate_connection.ps1 -Environment preview -Action materialize
```

Create the exact Pages project when absent:

```powershell
.\scripts\delegate_connection.ps1 -Environment preview -Action create-project -Apply
```

Synchronize configured runtime secrets:

```powershell
.\scripts\delegate_connection.ps1 -Environment preview -Action sync-secrets -Apply
```

Deploy Preview:

```powershell
.\scripts\delegate_connection.ps1 -Environment preview -Action deploy -Apply
```

Full Preview setup:

```powershell
.\scripts\delegate_connection.ps1 -Environment preview -Action all -Apply
```

Production requires the additional explicit guard:

```powershell
.\scripts\delegate_connection.ps1 -Environment production -Action all -Apply -AllowProduction
```

The script chooses LIVE credentials automatically for Production.

## Secret activation policy

The current Business Decision Lab / Make or Buy Lab v1 calculation engines do not require Stripe, OAuth, or webhook secrets.

Those mappings are therefore present but marked `required:false`.

When a commercial feature is implemented, change only the required secret mappings to `required:true`. Then delegation fails closed if the master vault lacks them.

## Webhook handling

The webhook endpoint URL belongs in the application/service configuration and provider dashboard.

The webhook signing secret belongs only in the central master.env and Cloudflare encrypted secret.

Never put a `whsec_...`, Stripe secret key, Google client secret, or Cloudflare token in:

- source code
- README
- service-registry.json
- GitHub commit
- browser JavaScript

## Cloudflare Pages support

Wrangler currently supports Pages project creation, deployment, and secret bulk upload, so the wrapper can automate those actions without using the dashboard each time. citeturn198756search0turn198756search2
