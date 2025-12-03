# User Verification Flow

This document describes the complete user journey from the Business App through the Verification Service and back.

---

## Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              USER JOURNEY                                       │
└────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐
    │  BUSINESS APP   │
    │  (merchant.     │
    │  heydollr.app)  │
    └────────┬────────┘
             │
             │ 1. User completes KYC form
             │    (name, email, business info)
             │
             ▼
    ┌─────────────────┐
    │  Store pending  │
    │  business data  │
    │  in localStorage│
    └────────┬────────┘
             │
             │ 2. Redirect to verification service
             │
             │    URL: https://verify.heydollr.app/selfie
             │         ?token={auth_token}
             │         &callback={callback_url}
             │
             ▼
    ┌─────────────────┐
    │ VERIFICATION    │
    │ SERVICE         │
    │ (verify.        │
    │ heydollr.app)   │
    └────────┬────────┘
             │
             │ 3. Validate token
             │ 4. Show intro screen
             │ 5. User captures selfie
             │ 6. Upload to Dollr API
             │ 7. Create KYC record
             │
             ▼
    ┌─────────────────┐
    │  Success Screen │
    │  "Identity      │
    │   Verified!"    │
    └────────┬────────┘
             │
             │ 8. User clicks "Continue"
             │
             │    Redirect to callback:
             │    {callback}?status=success
             │              &user_id={id}
             │              &verification_id={kyc_id}
             │
             ▼
    ┌─────────────────┐
    │  BUSINESS APP   │
    │  /auth/         │
    │  verification-  │
    │  callback       │
    └────────┬────────┘
             │
             │ 9. Handle verification result
             │ 10. Create micro-organization
             │ 11. Redirect to dashboard
             │
             ▼
    ┌─────────────────┐
    │  DASHBOARD      │
    │  User is now    │
    │  verified! ✅   │
    └─────────────────┘
```

---

## Step-by-Step Breakdown

### Step 1: User Starts KYC in Business App

User fills out KYC form with:
- Business name
- Business email
- Phone number
- Country
- Business description

### Step 2: Business App Redirects to Verification Service

```javascript
// Business App code
const token = getAuthToken(); // User's Dollr API auth token
const callbackUrl = encodeURIComponent(
  'https://merchant.heydollr.app/auth/verification-callback'
);

window.location.href = `https://verify.heydollr.app/selfie?token=${token}&callback=${callbackUrl}`;
```

**Example URL:**
```
https://verify.heydollr.app/selfie?token=eyJhbGciOiJIUzI1NiIs...&callback=https%3A%2F%2Fmerchant.heydollr.app%2Fauth%2Fverification-callback
```

---

### Step 3: Verification Service Validates Token

The verification service:
1. Reads `token` and `callback` from URL parameters
2. Decodes the JWT to extract `user_id`
3. Validates token hasn't expired

If token is missing or invalid → Shows error screen with "Return to App" button

---

### Step 4: User Sees Intro Screen

Shows requirements:
- ✅ Ensure good lighting and center your face
- ✅ Keep a neutral expression
- ✅ Remove sunglasses or hat

User clicks **"Begin Verification"**

---

### Step 5: User Captures Selfie

- Camera activates (front-facing)
- Face detection validates positioning
- User clicks **"Capture Selfie"**
- Preview shown with **"Retake"** or **"Submit"** options

---

### Step 6: Upload Selfie to Dollr API

```
POST https://dollr-api-2crdudxdoq-bq.a.run.app/v1/compliance/upload/kyc/doc
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [selfie image]
```

**Response:**
```json
{
  "doc_url": "https://storage.googleapis.com/..."
}
```

---

### Step 7: Create KYC Record

```
POST https://dollr-api-2crdudxdoq-bq.a.run.app/v1/compliance/kyc/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "doc_type": "selfie",
  "doc_url": "https://storage.googleapis.com/...",
  "doc_number": "SELFIE-123-1701648000"
}
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

### Step 8: Redirect Back to Business App

User clicks **"Continue"** on success screen.

**Success redirect:**
```
https://merchant.heydollr.app/auth/verification-callback?status=success&user_id=123&verification_id=456
```

**Failure redirect:**
```
https://merchant.heydollr.app/auth/verification-callback?status=failed&user_id=123&reason=upload_failed
```

---

### Step 9: Business App Handles Callback

The `/auth/verification-callback` page in the business app:

1. Reads query parameters (`status`, `user_id`, `verification_id`)
2. If `status=success`:
   - Retrieves pending business data from localStorage
   - Creates micro-organization via Dollr API
   - Redirects to dashboard
3. If `status=failed`:
   - Shows error message
   - Offers retry option

---

## Error Handling

| Error | Where | User Experience |
|-------|-------|-----------------|
| Missing token | Verification Service | "Authentication Required" screen with "Return to App" button |
| Expired token | Verification Service | "Token Expired" error, redirects back with `status=failed&reason=token_expired` |
| Camera access denied | Verification Service | "Unable to access camera" error message |
| Upload failed | Verification Service | "Verification failed. Please try again." with retry option |
| API error | Verification Service | Generic error, redirects with `status=failed&reason=api_error` |

---

## Callback Parameters

### Success
| Parameter | Description | Example |
|-----------|-------------|---------|
| `status` | Always `"success"` | `success` |
| `user_id` | User's ID from token | `123` |
| `verification_id` | KYC record ID | `456` |

### Failure
| Parameter | Description | Example |
|-----------|-------------|---------|
| `status` | Always `"failed"` | `failed` |
| `user_id` | User's ID (if available) | `123` |
| `reason` | Error reason | `upload_failed`, `token_expired`, `user_cancelled` |

### Pending (if applicable)
| Parameter | Description | Example |
|-----------|-------------|---------|
| `status` | Always `"pending"` | `pending` |
| `user_id` | User's ID from token | `123` |
| `verification_id` | KYC record ID | `456` |

---

## Testing the Flow

### Local Testing

1. Start the verification service:
   ```bash
   pnpm dev
   ```

2. Open with test parameters:
   ```
   http://localhost:3000/selfie?token=YOUR_JWT_TOKEN&callback=http://localhost:3001/auth/verification-callback
   ```

### Production Testing

```
https://verify.heydollr.app/selfie?token={real_auth_token}&callback=https://merchant.heydollr.app/auth/verification-callback
```

---

## Sequence Diagram

```
Business App          Verification Service         Dollr API
     │                        │                        │
     │  redirect with token   │                        │
     │───────────────────────>│                        │
     │                        │                        │
     │                        │  decode JWT            │
     │                        │  (get user_id)         │
     │                        │                        │
     │                        │  [User captures selfie]│
     │                        │                        │
     │                        │  POST /upload/kyc/doc  │
     │                        │───────────────────────>│
     │                        │                        │
     │                        │  { doc_url: "..." }    │
     │                        │<───────────────────────│
     │                        │                        │
     │                        │  POST /kyc/create      │
     │                        │───────────────────────>│
     │                        │                        │
     │                        │  { id: 456, ... }      │
     │                        │<───────────────────────│
     │                        │                        │
     │  redirect with status  │                        │
     │<───────────────────────│                        │
     │                        │                        │
     │  [Handle result]       │                        │
     │  [Create micro-org]    │                        │
     │  [Show dashboard]      │                        │
     │                        │                        │
```
