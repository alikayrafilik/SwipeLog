type AuthEmailKind = 'verification' | 'password-reset';

const authEmailFunctionBaseUrl = process.env.EXPO_PUBLIC_AUTH_EMAIL_FUNCTION_BASE_URL?.replace(/\/$/, '');

const endpointByKind: Record<AuthEmailKind, string> = {
  verification: 'sendVerificationEmail',
  'password-reset': 'sendPasswordResetEmail',
};

export const isCustomAuthEmailEnabled = Boolean(authEmailFunctionBaseUrl);

export async function sendCustomAuthEmail(kind: AuthEmailKind, email: string) {
  if (!authEmailFunctionBaseUrl) {
    throw new Error('Custom auth email endpoint is not configured.');
  }

  const response = await fetch(`${authEmailFunctionBaseUrl}/${endpointByKind[kind]}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    let message = 'Auth email could not be sent.';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }
}
