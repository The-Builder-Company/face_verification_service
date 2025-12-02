# Dollr KYC Face Verification

This project provides a face verification interface for the Dollr KYC (Know Your Customer) service.

## Overview

The application captures a user's selfie and submits it for identity verification. It is built with Next.js and uses the browser's MediaDevices API to access the camera.

## Features

- **Face Detection UI**: Guides the user to position their face correctly.
- **Camera Integration**: Accesses the user's webcam or mobile camera.
- **Image Capture**: Captures a high-quality image for verification.
- **Verification API Integration**: Submits the captured image to the backend for processing.

## Getting Started

1.  Install dependencies:
    ```bash
    pnpm install
    ```

2.  Run the development server:
    ```bash
    pnpm dev
    ```

3.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## API Integration

The verification endpoint is located at `/api/verify`. It accepts a POST request with the captured image data.
