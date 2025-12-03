# Verification Service Integration Guide

This document outlines the required integration between the Dollr Business App and the verification microservice at `verify.heydollr.app`.

## Overview

When a sole proprietor completes KYC submission in the business app, they are redirected to the verification service to complete identity verification (e.g., liveness check, document verification). We need a secure way to:

1. Identify the user when they arrive at the verification service
2. Link the verification result back to their KYC record
3. Redirect them back to the business app after completion

---

## Integration Flow

```
┌─────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────┐
│   Business App          │      │  Verification Service    │      │   Dollr API     │
│ (merchant.heydollr.app) │      │ (verify.heydollr.app)    │      │                 │
└─────────────────────────┘      └──────────────────────────┘      └─────────────────┘
         │                              │                              │
         │  1. Redirect with token      │                              │
         │ ─────────────────────────────>                              │
         │                              │                              │
         │                              │  2. Validate token           │
         │                              │  (decode JWT)                │
         │                              │                              │
         │                              │  3. User completes selfie    │
         │                              │                              │
         │                              │  4. Upload selfie            │
         │                              │ ─────────────────────────────>
         │                              │                              │
         │                              │  5. Create KYC record        │
         │                              │ ─────────────────────────────>
         │                              │                              │
         │                              │  6. (Optional) Webhook       │
         │                              │ ─────────────────────────────>
         │                              │                              │
         │  7. Redirect with status     │                              │
         │ <─────────────────────────────                              │
         │                              │                              │
```

---

## Agreed Integration Points

### 1. Redirect URL Format

Business App redirects to:
```
https://verify.heydollr.app/selfie?token={auth_token}&callback={callback_url}
```

**Example:**
```
https://verify.heydollr.app/selfie?token=eyJhbGciOiJIUzI1NiIs...&callback=https%3A%2F%2Fmerchant.heydollr.app%2Fauth%2Fverification-callback
```

### 2. Token Details

The `token` parameter is the user's **Dollr API auth token** (JWT). We can:
1. Decode it to get `user_id`, `phone`, etc.
2. Use it to make authenticated API calls to Dollr API on behalf of the user

### 3. Callback URL Format (After Verification)

**Success:**
```
{callback_url}?status=success&user_id={user_id}&verification_id={id}
```

**Failure:**
```
{callback_url}?status=failed&user_id={user_id}&reason={reason}
```

**Pending Review:**
```
{callback_url}?status=pending&user_id={user_id}&verification_id={id}
```

---

## API Configuration

### Base URL
```
https://dollr-api-2crdudxdoq-bq.a.run.app
```

### Authentication
Use the token from the URL as `Authorization: Bearer {token}`

### Endpoints

| Action | Endpoint | Method | Content-Type |
|--------|----------|--------|--------------|
| Upload selfie | `/v1/compliance/upload/kyc/doc` | POST | multipart/form-data |
| Create KYC record | `/v1/compliance/kyc/create` | POST | application/json |

---

## API Examples

### Upload Selfie

```bash
curl -X POST "https://dollr-api-2crdudxdoq-bq.a.run.app/v1/compliance/upload/kyc/doc" \
  -H "Authorization: Bearer {token}" \
  -F "file=@selfie.jpg"
```

**Response:**
```json
{
  "doc_url": "https://storage.googleapis.com/..."
}
```

### Create KYC Record

```bash
curl -X POST "https://dollr-api-2crdudxdoq-bq.a.run.app/v1/compliance/kyc/create" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "doc_type": "selfie",
    "doc_url": "https://storage.googleapis.com/...",
    "doc_number": "SELFIE-{user_id}-{timestamp}"
  }'
```

**Response:**
```json
{
  "id": 456,
  "doc_type": "selfie",
  "doc_url": "https://storage.googleapis.com/...",
  "doc_number": "SELFIE-123-1701648000",
  "status": "pending",
  "is_approved": false,
  "user_id": 123
}
```

---

## Verification Service Responsibilities

1. ✅ **Accept route** at `/selfie?token={jwt}&callback={url}`
2. ✅ **Decode the JWT** to extract user context (user_id, phone, etc.)
3. ✅ **Capture selfie/liveness** from user
4. ✅ **Upload selfie to Dollr API** → `POST /v1/compliance/upload/kyc/doc`
5. ✅ **Create KYC record** → `POST /v1/compliance/kyc/create`
6. ✅ **Redirect back** to callback URL with status

---

## Implementation Status

### Business App (merchant.heydollr.app) ✅

- [x] KYC document upload (`/compliance/upload/kyc/doc`)
- [x] KYC creation (`/compliance/kyc/create`)
- [x] Redirect to verification service with token and callback
- [x] Created `/auth/verification-callback` page
- [x] Handle verification result (success/failure/pending)
- [x] Auto-create micro-organization on successful verification

### Verification Service (verify.heydollr.app) ✅

- [x] Accept `/selfie?token={jwt}&callback={url}` route
- [x] Decode JWT to get user context
- [x] Selfie capture UI
- [x] Upload selfie to Dollr API
- [x] Create KYC record via Dollr API
- [x] Redirect to callback URL with status

---

## Files Implemented

| File | Purpose |
|------|---------|
| `lib/dollr-api.ts` | API client for Dollr endpoints (upload doc, create KYC) |
| `lib/token.ts` | JWT decoder to extract user_id, phone, etc. |
| `app/api/verify/route.ts` | Server endpoint that orchestrates the verification flow |
| `components/face-verification.tsx` | UI component with token/callback handling |
| `.env.example` | Environment variables template |

---

## Outstanding Questions

| # | Question | Status |
|---|----------|--------|
| 1 | **What `doc_type` value for selfies?** (`"selfie"`, `"liveness"`, `"face_photo"`) | ❓ Need answer from backend |
| 2 | **JWT signing secret** (if we need to validate signature) | ❓ Need from backend team |

---

## Security Considerations

- Handoff tokens should have short expiry (10-15 minutes)
- Tokens should be single-use (invalidate after verification starts)
- Callback URLs should be validated against whitelist
- Never pass sensitive data (passwords, full documents) in URL parameters
- Use HTTPS for all API calls

---

## Environment Variables Needed

```env
# Dollr API
DOLLR_API_BASE_URL=https://dollr-api-2crdudxdoq-bq.a.run.app

# Default callback (fallback)
DEFAULT_CALLBACK_URL=https://merchant.heydollr.app/auth/verification-callback

# KYC document type for selfies
KYC_DOC_TYPE=selfie
```
