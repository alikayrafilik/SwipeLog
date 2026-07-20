# SwipeLog Play Store release checklist

## Ready in the repository

- [x] Android package ID: `com.waage.SwipeLog`
- [x] Production build output explicitly set to Android App Bundle (AAB)
- [x] Remote versionCode with automatic increment
- [x] 512 × 512 opaque Play Store icon
- [x] 1024 × 500 feature graphic
- [x] Privacy policy, terms, support, and account deletion pages
- [x] In-app account deletion and data export controls
- [x] TMDB and JustWatch attribution
- [x] Store title, short description, full description, and release notes draft
- [x] Data Safety preparation document
- [x] No ads or advertising SDK in release 1.0.0
- [x] Target SDK supplied by Expo SDK 56 is compatible with current Play requirements

## Final candidate QA

- [ ] Install the version 13 preview APK on a real Android phone
- [ ] Complete `docs/android-release-qa-evidence.md`
- [ ] Verify password reset with a newly requested email and the latest link
- [ ] Verify email verification, account deletion, shared lists, Letterboxd import, notifications, and relaunch
- [ ] Confirm corrected native splash appearance from a cold launch
- [ ] Run `npm run check`, `npm run check:hosting`, `npm run check:release`, and `npx expo-doctor`
- [ ] Review the Google Play pre-launch report after uploading the AAB

## Play Console — owner actions

- [ ] Create the Play Console app as **SwipeLog**, default language English
- [ ] Confirm developer identity and Android device verification tasks
- [ ] Set category to Entertainment and declare that the app contains no ads
- [ ] Complete App access with a dedicated, verified reviewer account
- [ ] Complete Data Safety using `docs/play-store-data-safety.md`
- [ ] Complete content rating and target audience (13+; not designed for children)
- [ ] Add privacy policy and account deletion URLs
- [ ] Upload at least two final phone screenshots; recommended set is six
- [ ] Select countries/regions and confirm the app is free
- [ ] If the account is a new personal account, run a closed test with at least 12 opted-in testers for 14 consecutive days
- [ ] Apply for production access after the closed-test requirement is satisfied

## Release sequence

1. Finish preview QA and resolve blockers.
2. Build the production AAB with `eas build --platform android --profile production`.
3. Upload the first AAB manually to Play Console internal testing.
4. Review automated pre-launch results and tester feedback.
5. Promote to closed testing when stable.
6. Request production access if required, then release with a staged rollout.
