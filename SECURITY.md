# Security Implementation

This document outlines the security measures implemented in this application to protect API keys, user data, and prevent unauthorized access.

## 🔒 Security Features Implemented

### 1. API Key Protection

**Problem Solved**: API keys for OpenAI, Replicate, and fal.ai are now completely server-side only.

- ✅ Removed all client-side API key access (`client/src/lib/openai.ts` deleted)
- ✅ All AI generation happens through authenticated backend routes
- ✅ API keys are only accessible via `process.env` on the server
- ✅ No API keys are ever sent to the browser or included in client bundles

**What users cannot see**:
- OpenAI API keys
- Replicate API tokens  
- fal.ai API keys
- Database connection strings
- Session secrets

### 2. Rate Limiting

All generation and enhancement endpoints now have strict rate limits per user:

| Endpoint | Limit | Window |
|----------|-------|---------|
| Image Generation | 10 requests | 1 minute |
| Video Generation | 5 requests | 1 minute |
| Prompt Enhancement | 20 requests | 1 minute |
| File Uploads | 30 requests | 1 minute |
| Speech-to-Text | 10 requests | 1 minute |

**Headers returned**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### 3. Authentication & Authorization

**Protected Routes**:
- All `/api/images/generate` - requires authentication
- All `/api/videos/generate` - requires authentication
- All `/api/video/jobs` - requires authentication
- All `/api/admin/*` - requires admin role
- All `/api/enhance-prompt` - requires authentication
- All `/api/upload-*` - requires authentication

**Newly Secured**:
- `/api/videos/:id/status` - now requires authentication (was public)
- `/api/images/repair` - now requires admin (was public)
- `/api/videos/repair` - now requires admin (was public)

### 4. Input Validation & Sanitization

**Prompt Validation**:
- Maximum prompt length: 5,000 characters
- Prompts are trimmed and validated
- Empty prompts are rejected

**Tags Validation**:
- Maximum tags per request: 20
- Maximum tag length: 50 characters
- Invalid tags are filtered out

**File Upload Limits**:
- Images: 10MB per file, max 10 files
- Audio: 30MB per file

### 5. Configuration Sanitization

The `/api/config` endpoint now sanitizes all responses to prevent leaking:
- API keys (OpenAI, Replicate, FAL)
- Database URLs
- Session secrets
- Admin passwords
- Any field containing "key", "token", "secret", "password"

### 6. Security Headers

All responses include comprehensive security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: [configured]
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Request Size Limits**:
- JSON payloads: 10MB maximum
- URL-encoded data: 10MB maximum

### 7. Request Logging & Monitoring

- Suspicious activity is logged with user ID, IP, and user agent
- All failed rate limit attempts are logged
- Security headers are validated on startup

## 🛡️ How User Data is Protected

### When Generating Images/Videos:

1. **User makes request** → Frontend calls `/api/images/generate`
2. **Authentication checked** → Must be logged in
3. **Rate limit checked** → Maximum 10 images/min or 5 videos/min
4. **Input validated** → Prompt length, tags validated
5. **Credits checked** → Sufficient balance required
6. **Server-side generation** → API keys are used on backend only
7. **Response returned** → Only the generated image/video URL is sent

**At no point** are API keys, credentials, or sensitive data exposed to the client.

### Reference Images (Saudi Model Example):

When users upload reference images for style transfer:

1. Images are uploaded via authenticated endpoint only
2. Files are validated (type, size) on the server
3. Images are stored in `/uploads/ref-images/` on the server
4. Only the file URL is sent to the AI API (not the API key)
5. The AI provider receives the image URL, not your API credentials

**Security guarantee**: Even if someone intercepts the reference image URL sent to the AI provider, they cannot:
- See your API keys
- Access your database
- Impersonate users
- Generate content without credits

## 🔍 Testing Security

To verify no API keys are exposed:

1. **Open browser DevTools** (F12)
2. **Go to Network tab**
3. **Generate an image/video**
4. **Inspect the request**:
   - ✅ No API keys in request headers
   - ✅ No API keys in request body
   - ✅ No API keys in response

5. **Check Sources tab**:
   - ✅ Search for "OPENAI_API_KEY" - should not exist
   - ✅ Search for "REPLICATE" - should not exist  
   - ✅ Search for "FAL_KEY" - should not exist

## 🚨 What If Security is Compromised?

If you suspect your API keys have been exposed:

1. **Rotate API keys immediately**:
   - OpenAI: https://platform.openai.com/api-keys
   - Replicate: https://replicate.com/account/api-tokens
   - fal.ai: https://fal.ai/dashboard/keys

2. **Update environment variables** in Replit Secrets

3. **Monitor usage** on each platform for unusual activity

4. **Check server logs** for suspicious requests

## 📋 Security Checklist

- [x] API keys are server-side only
- [x] All generation endpoints require authentication
- [x] Rate limiting is active on all generation endpoints
- [x] Input validation prevents malicious payloads
- [x] Config endpoint is sanitized
- [x] Security headers are configured
- [x] Request size limits prevent DoS
- [x] Admin routes require admin role
- [x] File uploads are validated and limited
- [x] Suspicious activity is logged

## 🔐 Developer Notes

### Adding New AI Endpoints

When adding new AI generation features:

1. ✅ Add authentication: `isAuthenticated` middleware
2. ✅ Add rate limiting: Use appropriate rate limiter from `security-middleware.ts`
3. ✅ Add input validation: Use `validatePromptInput` middleware
4. ✅ Keep API calls server-side: Never expose API clients to frontend
5. ✅ Log suspicious activity: Use `logSuspiciousActivity` helper

### Example:
```typescript
app.post("/api/new-generation", 
  isAuthenticated, 
  imageGenerationRateLimit, 
  validatePromptInput, 
  async (req: any, res) => {
    // Your secure generation code
  }
);
```

## 📞 Questions?

If you have security concerns or find vulnerabilities, please review this document and verify all measures are in place.
