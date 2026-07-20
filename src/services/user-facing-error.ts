type ErrorWithCode = { code?: unknown; message?: unknown };

const getCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return '';
  const code = (error as ErrorWithCode).code;
  return typeof code === 'string' ? code : '';
};

export const getUserFacingError = (error: unknown, fallback = 'Please try again.') => {
  const code = getCode(error);
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'The email or password is incorrect.';
  if (code.includes('invalid-email')) return 'Enter a valid email address.';
  if (code.includes('email-already-in-use')) return 'An account already exists for this email.';
  if (code.includes('user-not-found')) return 'We could not find an account for this email.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Wait a few minutes and try again.';
  if (code.includes('network-request-failed') || code.includes('unavailable')) return 'Check your internet connection and try again.';
  if (code.includes('permission-denied')) return 'You do not have permission to perform this action.';
  if (code.includes('requires-recent-login')) return 'Sign in again before completing this action.';
  if (code.includes('storage/unauthorized')) return 'SwipeLog cannot access this file.';
  return fallback;
};
