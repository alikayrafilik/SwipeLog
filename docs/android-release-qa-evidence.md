# Android release QA evidence

Complete this document against the exact AAB/APK candidate identified below. Do not approve production from Expo Go evidence.

## Candidate

- Git commit:
- EAS build ID:
- App version / version code:
- Build profile:
- Android device and OS:
- Tester:
- Test date:

## Automated gates

- [ ] `npm run check`
- [ ] `npx expo-doctor` — 21/21
- [ ] `npm run check:hosting`
- [ ] `npm run check:release`
- [ ] No high or critical production dependency advisory
- [ ] EAS build completed successfully
- [ ] Play pre-launch report reviewed

## Authentication and account lifecycle

- [ ] New email/password registration
- [ ] Verification email arrives outside spam
- [ ] Verification link opens the intended flow
- [ ] Verified sign-in succeeds
- [ ] Wrong-password error is understandable
- [ ] Password-reset email and link work
- [ ] Sign-out and relaunch work
- [ ] Account deletion removes access and cloud data
- [ ] Public web deletion-request page works

## Core product

- [ ] Fresh onboarding completes
- [ ] Browse loads and refreshes
- [ ] Search returns results and opens movie details
- [ ] Discover completes at least 30 swipes without visible frame stalls
- [ ] Watchlist add/remove persists after relaunch
- [ ] Diary entry, rating, note, and rewatch persist
- [ ] Custom list and tier list persist
- [ ] Letterboxd import dry run completes or cancels safely
- [ ] Trailer and external links open without a crash
- [ ] TMDB and JustWatch attribution links work

## Social and shared lists

- [ ] Public profile opens from a second account
- [ ] Friend request send/accept works
- [ ] Shared watchlist can be created and joined
- [ ] Both accounts can add, vote, and mark watched according to permissions
- [ ] Owner and member deletion/leave behavior is correct

## Device behavior

- [ ] Notification permission can be accepted and denied safely
- [ ] Release reminder test works
- [ ] Profile image permission and selection work
- [ ] Background/foreground three times without lost state
- [ ] Kill and relaunch without crash
- [ ] 30-minute navigation smoke test without crash or ANR
- [ ] No sustained memory growth observed during repeated navigation

## Decision

- Result: SHIP / HOLD / RETEST
- Blocking findings:
- Follow-up build ID, if any:

