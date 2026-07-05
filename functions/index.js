const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

const resendApiKey = defineSecret('RESEND_API_KEY');
const mailFrom = process.env.AUTH_MAIL_FROM || 'SwipeLog <noreply@swipelog.app>';
const appBaseUrl = process.env.APP_BASE_URL || 'https://swipelog.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function sendJson(response, status, body) {
  response.set(corsHeaders);
  response.status(status).json(body);
}

function getEmail(request) {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required.');
  }
  return email;
}

function getActionCodeSettings() {
  const baseUrl = appBaseUrl.replace(/\/$/, '');
  return {
    url: `${baseUrl}/auth`,
    handleCodeInApp: true,
    android: {
      packageName: 'com.waage.SwipeLog',
      installApp: true,
    },
    iOS: {
      bundleId: 'com.waage.swipelog',
    },
    linkDomain: 'swipelog.app',
  };
}

function buildEmailHtml({ title, intro, buttonLabel, actionLink, footer }) {
  return `
    <div style="margin:0;padding:0;background:#071b2b;font-family:Inter,Arial,sans-serif;color:#ffffff;">
      <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
        <div style="font-size:28px;font-weight:900;letter-spacing:.2px;margin-bottom:24px;">SwipeLog</div>
        <div style="background:#0b3142;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:28px;">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#ffffff;">${title}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.55;color:#d7e7ec;">${intro}</p>
          <a href="${actionLink}" style="display:inline-block;background:#f9c80e;color:#073445;text-decoration:none;font-weight:900;border-radius:14px;padding:14px 20px;">${buttonLabel}</a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.55;color:#a8bec7;">If the button does not work, copy and paste this link into your browser:<br>${actionLink}</p>
        </div>
        <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8da6b1;">${footer}</p>
      </div>
    </div>
  `;
}

async function sendResendEmail({ to, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: mailFrom,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Resend failed: ${message}`);
  }
}

exports.sendVerificationEmail = onRequest({ secrets: [resendApiKey] }, async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.set(corsHeaders);
    response.status(204).send('');
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const email = getEmail(request);
    const actionLink = await admin.auth().generateEmailVerificationLink(email, getActionCodeSettings());
    await sendResendEmail({
      to: email,
      subject: 'Verify your SwipeLog email',
      html: buildEmailHtml({
        title: 'Verify your email',
        intro: 'Confirm this email address to finish setting up your SwipeLog account.',
        buttonLabel: 'Verify email',
        actionLink,
        footer: 'You received this email because someone created a SwipeLog account with this address.',
      }),
    });
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Verification email failed.' });
  }
});

exports.sendPasswordResetEmail = onRequest({ secrets: [resendApiKey] }, async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.set(corsHeaders);
    response.status(204).send('');
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const email = getEmail(request);
    const actionLink = await admin.auth().generatePasswordResetLink(email, getActionCodeSettings());
    await sendResendEmail({
      to: email,
      subject: 'Reset your SwipeLog password',
      html: buildEmailHtml({
        title: 'Reset your password',
        intro: 'Use this secure link to create a new password for your SwipeLog account.',
        buttonLabel: 'Reset password',
        actionLink,
        footer: 'You received this email because a password reset was requested for your SwipeLog account.',
      }),
    });
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : 'Password reset email failed.' });
  }
});
