# Firebase Authentication Email Setup

SwipeLog uses Firebase Authentication's built-in verification and password reset emails. The app does not require a custom email delivery function for these flows.

## Firebase email templates

In Firebase Console, open **Authentication > Templates** and configure both:

- Email address verification
- Password reset

Set the sender name to `SwipeLog` and review the subject and body copy. SwipeLog does not currently own a custom domain, so do not select **Customize domain**. Firebase sends from and links through the project's default domain.

## Authorized domains and action URL

Keep these domains in **Authentication > Settings > Authorized domains**:

```text
swipelog-b563d.firebaseapp.com
```

The app sends this continue URL with verification and password reset requests:

```text
https://swipelog-b563d.firebaseapp.com/auth
```

Preview and production EAS profiles set it through:

```text
EXPO_PUBLIC_AUTH_CONTINUE_URL=https://swipelog-b563d.firebaseapp.com/auth
```

## Firebase Hosting mobile-link domain

Firebase Dynamic Links is no longer used. SwipeLog uses the project's default Firebase Hosting domain, so no purchased custom domain or DNS setup is required. Firebase serves mobile authentication links from:

```text
https://swipelog-b563d.firebaseapp.com/__/auth/links
```

## Mobile link requirements

The native app is configured to accept Firebase Hosting authentication links on iOS and Android. The domains must serve valid platform association files:

```text
https://swipelog-b563d.firebaseapp.com/.well-known/apple-app-site-association
https://swipelog-b563d.firebaseapp.com/.well-known/assetlinks.json
```

Register the Android package and production SHA-1/SHA-256 signing fingerprints in Firebase Project Settings. The Android app catches `/__/auth/links`. The iOS application must be registered with bundle ID `com.waage.swipelog`, and its associated-domain file must allow the Firebase authentication link path.

## Verification

After a new native build:

1. Create a test account and open the verification email on a physical device.
2. Request a password reset and complete it from the email link.
3. In Gmail, use **Show original** and confirm SPF, DKIM, and DMARC pass.
4. Repeat delivery tests with Outlook and iCloud.

Legacy Firebase Functions/Resend files can remain during rollout, but the app no longer calls them. Remove or undeploy them separately after production verification.
