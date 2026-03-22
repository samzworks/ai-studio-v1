# AI Multimedia Generation Platform

## Overview
This platform is an advanced AI-powered multimedia generation system focused on intelligent video and image creation with cinematic quality and dynamic interaction design. Its core purpose is to provide efficient media generation by integrating cutting-edge AI models for features such as image-to-video, text-to-video, image/video enhancement, and intelligent prompt management. The project aims to deliver a superior user experience in AI-driven content creation with a focus on business vision and market potential.

## User Preferences
- **Default AI Model:** GPT-5-nano (use this model for all OpenAI API calls going forward)
- **Saudi Model Enhancement:** Automatically enhance prompts for Saudi cultural context using GPT-5-nano
- **Film Studio Feature:** Users can now select AI model for storyboard generation - GPT-5-nano (Fast) or GPT-5 (Pro). Defaults to GPT-5-nano for cost efficiency.

## System Architecture
The platform features a React frontend utilizing Shadcn/ui components for a responsive user interface, and an Express.js backend for robust API management. Key architectural decisions include a component-based frontend, a modular backend with distinct layers for routes, storage, and AI integration, and a PostgreSQL database managed with Drizzle ORM.

**UI/UX Decisions:**
Emphasizes responsive design with Tailwind CSS, consistent aspect ratio handling for media display, and user-friendly progress indicators. Custom Unauthorized and 404 pages match the brand's dark purple gradient theme. Gallery hover buttons are always visible on all devices for accessibility.

**Technical Implementations & Features:**

*   **Auto-Deduct Credits System:** A comprehensive credit management system using the auth-hold pattern for safe, idempotent charging, supporting 27 AI models mapped to 20 operations for granular credit deduction.
*   **Subscription & Credits System:** A comprehensive subscription + credits system with a credit ledger, admin-managed subscription plans, top-up packs, coupons, and feature flags. It includes services for user entitlements and security middleware for server-side feature gating.
*   **Stripe Integration:** Full payment processing via Stripe for checkout sessions, webhook handling for subscription and payment events, and a customer portal for self-service subscription management.
*   **Film Studio:** A comprehensive feature for film production, guiding users from idea to final compilation through AI-generated storyboards, scene images, and videos, with version management and secure project updates.
*   **Multimedia Generation:** Supports image and video generation with advanced parameter controls and integrates multiple AI generation models.
*   **Dynamic Prompt Management:** A centralized system for AI prompt templates, offering database persistence, variable substitution, and model-specific overrides.
*   **Video Generation & Management:** Features model-driven field validation, dynamic frame computation, comprehensive progress tracking, thumbnail generation, and optimized gallery display.
*   **Voice Input Enhancement:** Refactored Web Speech API hook for reliable voice input across mobile browsers, ensuring accurate transcriptions and seamless language switching.
*   **Saudi Model Dynamic Selection:** Intelligently selects between text-to-image and image-to-image models based on cultural relevance, including a premium 4K version with enhanced resolution and aspect ratios.
*   **Authentication & Authorization:** Uses Google OAuth for session-based authentication and role-based access control. Works consistently across both Replit and local development environments.
*   **Database Design:** Utilizes Drizzle ORM for managing schemas including Users, Images, Videos, Favorites, Credit Transactions, and Admin features.
*   **Translation & Internationalization System:** A robust bilingual system supporting English and Arabic with local-first translations, automatic fallbacks, and a database-first architecture where JSON files serve as the source of truth, synced with a smart upsert script.
*   **Image Reference Storage:** Stores relative paths for image references in the database and generates absolute URLs at request time, with automatic migration for existing data. Configuration for image reference categories and metadata is stored in object storage to ensure consistency between development and production environments.
*   **Credit Request & Email Notification System:** A complete admin-user communication system for credit requests, including user forms, email notifications via Resend, admin approval/rejection, and a full audit trail.
*   **Model Display Names System:** Centralized system using hooks to ensure user-friendly display names for AI models appear throughout the UI, with fallback mappings and admin-configurable names.
*   **Progress Card JobId Matching System:** Implemented jobId tracking to ensure progress cards properly disappear after image generation completes, especially on mobile devices.
*   **Public Gallery Performance Optimization:** Comprehensive performance improvements including N+1 query fix, skeleton loading, optimized image loading with CSS aspect-ratio and lazy loading, Web Vitals tracking, API caching, and cursor pagination.
*   **Image Generation Job Queue System:** A comprehensive parallel job queue allowing background image generations with status tracking, per-user parallel limits, rate limiting, and configurable admin settings.

## External Dependencies
*   **OpenAI GPT-5-nano:** Utilized for intelligent content generation, enhancement, translation, and Saudi prompt contextualization.
*   **Replicate API:** The primary service for video generation and other AI model integrations.
*   **Resend (via Replit Integration):** Transactional email service for credit request notifications and user communications.
*   **Stripe:** Payment processing for subscriptions and credit pack purchases.
*   **PostgreSQL (via Neon):** The relational database used for persistent data storage.
*   **Drizzle ORM:** Employed for defining and interacting with the database schema.
*   **Tailwind CSS:** Used for responsive styling in the frontend.

## Local Development Setup

This project supports dual-environment development: local VS Code and Replit.

### Environment Detection
The system automatically detects the running environment for storage:
- **Replit**: Uses Replit Object Storage
- **Local**: Uses Local File Storage (./uploads directory)
- **Authentication**: Google OAuth is used in both environments

### Required Environment Variables for Local Development
```
# Database (same Neon connection works everywhere)
DATABASE_URL=postgresql://...

# Google OAuth (for local authentication)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# API Keys for AI services
FAL_KEY=your-fal-key
OPENAI_API_KEY=your-openai-key
REPLICATE_API_TOKEN=your-replicate-token

# Stripe (for payments)
STRIPE_SECRET_KEY=your-stripe-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret
```

### Key Files for Dual-Environment Support
- `server/storageProvider.ts` - Storage abstraction layer
- `server/localFileStorage.ts` - Local filesystem implementation
- `server/objectStorage.ts` - Replit Object Storage implementation
- `server/auth.ts` - Auth entry point (delegates to Google OAuth)
- `server/googleAuth.ts` - Google OAuth implementation (used everywhere)

### Important Notes
- Files uploaded locally are stored in `./uploads/` and won't sync to Replit Object Storage
- Database changes sync automatically via Neon PostgreSQL
- Push code to GitHub, then pull into Replit to sync code changes