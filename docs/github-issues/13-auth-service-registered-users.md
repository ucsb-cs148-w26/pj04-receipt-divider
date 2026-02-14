# Feature: Authentication Service for Registered Users

## Description
Implement a comprehensive authentication service for registered users (receipt hosts) to secure the application and enable user-specific features. This includes user registration, login, session management, and integration with the backend.

## Acceptance Criteria
- [ ] Choose authentication provider/method:
  - Firebase Auth, Supabase Auth, or custom JWT-based auth
  - Support email/password authentication
  - Consider social login (Google, Apple) for future
- [ ] Backend: Implement auth service:
  - User registration endpoint (`POST /api/auth/register`)
  - User login endpoint (`POST /api/auth/login`)
  - Token validation middleware
  - Password hashing (bcrypt or similar)
  - JWT token generation and validation
  - Refresh token mechanism
- [ ] Backend: Protect endpoints:
  - Require authentication for receipt creation
  - Require authentication for share link generation
  - Allow guest access for join links
  - Add user ID to all user-specific operations
- [ ] Frontend: Implement auth UI:
  - Registration form (email, password, name)
  - Login form
  - Logout functionality
  - Password validation and strength indicator
  - Error handling and display
- [ ] Frontend: Auth state management:
  - Store auth token securely (AsyncStorage for mobile, localStorage for web)
  - Persist user session
  - Auto-logout on token expiration
  - Redirect to login when needed
- [ ] Frontend: Protected routes:
  - Redirect unauthenticated users to login
  - Allow guest access to shared receipts
  - Show different UI for authenticated vs guest users
- [ ] Implement user profile:
  - Store user name, email
  - Optional profile picture
  - User preferences
- [ ] Security considerations:
  - HTTPS only
  - CORS configuration
  - Rate limiting on auth endpoints
  - Password reset functionality (optional for MVP)
- [ ] Test authentication flow:
  - Registration works correctly
  - Login works correctly
  - Token validation works
  - Protected endpoints reject unauthenticated requests
- [ ] Document authentication setup and API

## Priority
**High** - Essential for user management and security

## Labels
`feature`, `authentication`, `backend`, `frontend`, `security`
