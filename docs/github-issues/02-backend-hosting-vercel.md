# Backend Hosting on Vercel

## Description
Deploy the FastAPI backend to Vercel for production use. Configure the backend to handle API requests from both web and mobile clients with proper environment variable management.

## Acceptance Criteria
- [ ] Create Vercel project for backend deployment
- [ ] Configure `vercel.json` for FastAPI deployment
- [ ] Set up environment variables in Vercel dashboard:
  - Database connection strings
  - API keys (OpenAI, Google Cloud Vision)
  - Other sensitive configuration
- [ ] Configure CORS settings to allow requests from:
  - Production web frontend domain
  - Mobile app (React Native)
- [ ] Disable OpenAPI documentation endpoints in production (`/docs`, `/redoc`)
  - Add environment check to conditionally disable OpenAPI routes
  - Update `app/main.py` to exclude docs when `ENVIRONMENT=production`
- [ ] Test all API endpoints work correctly in production
- [ ] Set up custom domain (if applicable)
- [ ] Configure appropriate rate limiting and security headers
- [ ] Document deployment process in backend README
- [ ] Verify backend health check endpoint is accessible

## Priority
**High** - Critical for production deployment

## Labels
`deployment`, `backend`, `vercel`, `infrastructure`
