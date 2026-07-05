# Custom Auth Email Setup

SwipeLog can send Firebase verification and password reset emails through Resend instead of Firebase's default sender.

## Why

Firebase's default auth emails may use a project-looking sender/domain. For production, use a verified app domain such as:

```text
noreply@swipelog.app
```

This improves trust and deliverability when SPF, DKIM, and DMARC are configured.

## Resend

1. Create a Resend account.
2. Add `swipelog.app` as a sending domain.
3. Add the DNS records Resend gives you:
   - SPF
   - DKIM
   - DMARC
4. Wait until Resend shows the domain as verified.

## Firebase Secrets

Set the Resend API key as a Firebase Functions secret:

```powershell
npx firebase-tools functions:secrets:set RESEND_API_KEY --project swipelog-b563d
```

Set public function params:

Create `functions/.env`:

```text
AUTH_MAIL_FROM=SwipeLog <noreply@swipelog.app>
APP_BASE_URL=https://swipelog.app
```

## Deploy

Deploy functions:

```powershell
npx firebase-tools deploy --only functions --project swipelog-b563d
```

The default HTTPS base URL should look like:

```text
https://us-central1-swipelog-b563d.cloudfunctions.net
```

Add that to Expo/EAS env:

```text
EXPO_PUBLIC_AUTH_EMAIL_FUNCTION_BASE_URL=https://us-central1-swipelog-b563d.cloudfunctions.net
```

Restart Expo with cache clear:

```powershell
npx expo start -c
```

## Firebase Auth Domain

Keep these domains in Firebase Authentication authorized domains:

```text
swipelog.app
www.swipelog.app
swipelog-b563d.firebaseapp.com
```

The app still falls back to Firebase default emails if `EXPO_PUBLIC_AUTH_EMAIL_FUNCTION_BASE_URL` is empty.
