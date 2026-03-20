# Deployment Guide

This document outlines the deployment architecture, system dependencies, and environment setup for the **Eezy Receipt** mobile app, web app, and backend services.

## Table of Contents
1. [Deployment Overview](#1-deployment-overview)  
2. [System Dependencies](#2-system-dependencies)  
3. [Environment Variables](#3-environment-variables)  
4. [Deployment Instructions](#4-deployment-instructions)  
   - [Mobile Application](#mobile-application)  
   - [Web Application](#web-application)  
   - [Backend API](#backend-api)  
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Deployment Overview

### Mobile Application (React Native)
- Cross-platform mobile app built with React Native
- iOS deployment requires an Apple Developer account
- Distributed via:
  - Apple App Store
  - Google Play Store

### Web Application (React SPA)
- Single Page Application (SPA)
- Recommended hosting: **Vercel**
- Outputs a static `dist/` bundle

### Backend API (FastAPI)
- RESTful API built with FastAPI
- Can be deployed on:
  - AWS
  - Vercel (serverless)
  - Any container-based platform

### Database (Supabase)
- Managed PostgreSQL via Supabase
- SQL schema and RLS policies located in: `backend/sql/`

---

## 2. System Dependencies

Ensure the following tools are installed:

* **Frontend Package Manager**: npm
* **Backend Package Manager**: uv

---

## 3. Environment Variables
### Mobile (`frontend/apps/mobile/.env`)
```
EXPO_PUBLIC_API_URL=<backend-deployment-url>
EXPO_PUBLIC_FRONTEND_URL=<web-frontend-deployment-url>
EXPO_PUBLIC_SUPABASE_URL=<supabase-project-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supbase-project-annon-key>
```

### Web (`frontend/apps/web/.env`)
```
VITE_API_URL=<backend-deployment-url>
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supbase-project-annon-key>
```

### Backend (`backend/.env`)
```
DATABASE_USER=<database-username>
DATABASE_PASSWORD=<database-password>
DATABASE_HOST=<database-host-url>
DATABASE_PORT=<database-port>
DATABASE_NAME=<database-name>

SUPABASE_URL=<supabase-project-url>
SUPABASE_KEY=<supabase-service-role-key>  (DO NOT expose to frontend)
SUPABASE_JWT_PRIVATE_KEY=<JWT-signing-key> (get from Supabase settings)
SUPABASE_JWT_KID=<JWT key ID>
SUPABASE_JWT_ALGO=ES256

RECEIPT_IMAGE_BUCKET=<image-storage-bucket> (use Supabase storage)

FRONTEND_URL=<web-frontend-url>

GOOGLE_API_KEY=<google-cloud-api-key>
GOOGLE_VISION_URL=https://vision.googleapis.com/v1/images:annotate
OPENAI_MODEL=<openai-llm-model-name>
OPENAI_API_KEY=<openai-api-key>
```

---

## 4. Deployment Instructions

### Mobile Application

Clone the repository
```bash
git clone https://github.com/ucsb-cs148-w26/pj04-receipt-divider.git eezy-receipt && cd eezy-receipt/frontend
```

Install dependencies and add environment variables
```bash
npm ci
touch apps/mobile/.env
```

Build for deployment
```bash
# iOS build
npm run ios -w apps/mobile

# Android build
npm run android -w apps/mobile
```

Release via:
- Apple App Store
- Android app store 


### Web Application

Clone the repository
```bash
git clone https://github.com/ucsb-cs148-w26/pj04-receipt-divider.git eezy-receipt && cd eezy-receipt/frontend
```

Install dependencies and add environment variables
```bash
npm ci
touch apps/web/.env
```

Build for deployment
```bash
npm run build -w apps/web
```

Deploy the generated `dist/` to:
- Vercel (recommended)
- Netlify
- Any static hosting provider


### Backend API
Clone the repository
```bash
git clone https://github.com/ucsb-cs148-w26/pj04-receipt-divider.git eezy-receipt && cd eezy-receipt/backend
```

Install dependencies and add environment variables
```bash
uv sync --locked
touch .env
```
Production Deployment (Recommended)

Start the server on the deployment platform (Vercel, Docker + EC2, AWS Lambda)
```
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

---

## 5. Troubleshooting
Common Issues

1. Environment variables not loading:
- Ensure .env file is in the correct directory
- Restart the development server

2. Mobile build failures:
- Make sure that Xcode (iOS) or Android Studio is installed
- Have proper signing credentials configured
