# Dollr Face Verification Service - Project Overview

This document provides a comprehensive overview of the **Dollr Face Verification Service**, a Next.js application designed to capture and verify user selfies for KYC (Know Your Customer) compliance. It is built to be embedded or redirected to from a parent application.

## 1. Project Description
The service provides a secure, user-friendly interface for users to take a selfie. It performs real-time quality checks on the video feed to ensure the face is visible, centered, and well-lit before allowing the user to capture the image. The captured image is then sent to the Dollr API for verification.

## 2. Tech Stack

### Core Framework
- **Next.js 16.0.7**: The React framework used for both the frontend UI and the backend API routes.
- **TypeScript**: Used throughout for type safety.
- **Tailwind CSS**: Utility-first CSS framework for styling.

### Key Libraries
- **@mediapipe/tasks-vision**: Google's MediaPipe library used for real-time face detection, landmarking, and blendshape analysis (e.g., detecting if eyes are closed).
- **Zod**: Schema validation library used to validate API request bodies.
- **Lucide React**: Icon set for UI elements.
- **Radix UI**: Headless UI primitives for accessible components (Dialogs, Cards, etc.).

## 3. User Flow

The application follows a linear, step-by-step flow:

1.  **Initialization (`/` or `/selfie`)**:
    - The app expects a `token` query parameter (e.g., `?token=xyz`).
    - Optionally accepts a `callback` URL parameter.
    - **Validation**: If the token is missing, the app immediately shows an error state.

2.  **Camera Access & Real-time Checks**:
    - The user is prompted to allow camera access.
    - The video feed starts, and the `useFaceDetection` hook begins analyzing frames.
    - **Real-time Feedback**: The user sees messages like "Too dark", "Center your face", or "Look straight at the camera".
    - The "Capture" button remains disabled until all quality checks pass.

3.  **Capture & Review**:
    - Once the face is valid ("Perfect! Hold still..."), the user clicks "Capture".
    - The video feed freezes on the captured frame.
    - The user can choose to **"Retake"** or **"Submit"**.

4.  **Submission**:
    - The captured image (Base64) and the auth token are sent to the internal API route `/api/verify`.
    - The internal API proxies this request to the Dollr backend.

5.  **Completion**:
    - **Success**: A success screen is shown. Clicking "Continue" redirects the user to the `callback` URL with `?status=success`.
    - **Failure**: An error message is displayed. The user can try again. If they choose "Go Back", they are redirected to the callback URL with `?status=failed`.

## 4. Key Features

### Real-time Face Quality Analysis
The application doesn't just take a photo; it ensures the photo is usable for KYC before allowing capture. It checks:
- **Lighting**: Calculates average pixel brightness to ensure the scene isn't too dark.
- **Centering**: Uses facial landmarks (nose tip) to ensure the face is within the central 40% of the frame.
- **Orientation**: Compares the distance between the nose and ears to ensure the user is looking straight ahead (not turning left/right).
- **Eye State**: Uses blendshapes to detect if eyes are closed (blinking) and prevents capture.

### Secure Proxy Architecture
- The frontend never communicates directly with the Dollr API.
- All requests go through `/api/verify`, which acts as a Backend-for-Frontend (BFF).
- This allows for centralized validation, token handling, and error normalization.

## 5. Project Structure

```
├── app/
│   ├── api/verify/route.ts    # Internal API route (BFF)
│   ├── selfie/page.tsx        # Main page component
│   └── page.tsx               # Redirects/renders main component
├── components/
│   ├── face-verification.tsx  # Core UI logic and state machine
│   └── ui/                    # Reusable UI components (Buttons, Cards)
├── hooks/
│   └── use-face-detection.ts  # MediaPipe logic and quality checks
├── lib/
│   ├── dollr-api.ts           # Client for external Dollr API
│   └── token.ts               # Token decoding/validation utilities
└── public/                    # Static assets
```

## 6. API Integration

### Internal API (`/api/verify`)
- **Method**: `POST`
- **Body**: `{ image: string (base64), token: string }`
- **Validation**: Uses Zod to ensure `image` and `token` are present.
- **Response**:
  - Success: `{ success: true, verificationId: ..., userId: ... }`
  - Error: `{ success: false, error: "Message" }`

### External Dollr API Interaction
The `lib/dollr-api.ts` file handles the communication with the upstream Dollr service.
1.  **Upload**: Sends the image as `multipart/form-data` to `/v1/compliance/individual-verification/photo/upload`.
2.  **Create Record**: Creates a verification record via `/v1/compliance/individual-verification/photo/create`.

## 7. Error & Success Messages

### User-Facing Feedback (Real-time)
- "Scanning your face..."
- "Too dark. Ensure good lighting."
- "Position your face in the center."
- "Look straight at the camera."
- "Make sure your eyes are open."
- "Perfect! Hold still and capture."

### Application Errors
- "Missing authentication token. Please return to the app and try again."
- "Unable to access camera. Please check permissions."
- "Verification failed. Please try again." (Generic API error)

## 8. Environment Variables

The application relies on the following environment variables (defined in `.env`):
- `DOLLR_API_BASE_URL`: The base URL for the Dollr backend (e.g., `https://dollr-api-....run.app`).
- `DEFAULT_CALLBACK_URL`: Fallback URL if no callback is provided in the query params.
