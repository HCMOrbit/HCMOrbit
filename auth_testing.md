# HCMOrbit Auth Testing Playbook

## Auth Pattern
Bearer token (JWT for email/password, Emergent session_token for Google OAuth) stored in `localStorage` as `hcm_token` and sent via `Authorization: Bearer <token>`.

## Step 1: API Testing
```bash
# Register
curl -X POST "$BACKEND/api/auth/register" -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","username":"test_user_1","email":"t1@example.com","password":"Test123!"}'

# Login
TOKEN=$(curl -s -X POST "$BACKEND/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@hcmorbit.com","password":"Admin123!"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Me
curl -s "$BACKEND/api/auth/me" -H "Authorization: Bearer $TOKEN"
```

## Step 2: Demo Credentials
- Admin: `admin@hcmorbit.com` / `Admin123!`
- Demo users: any of the seed users (e.g. `elena_carter@hcmorbit.demo`) / `Demo123!`

## Step 3: Browser Testing (Playwright)
```js
await page.evaluate(() => localStorage.setItem('hcm_token', 'YOUR_TOKEN'));
await page.goto(BACKEND_URL + '/community');
```

## Success Indicators
- `/api/auth/me` returns user with `onboarded: true` for seed users
- Community feed loads 16 demo posts
- `/api/posts/{id}` returns post with author + space
