/**
 * Centralized, typed configuration loaded from environment variables.
 * Never hardcode secrets — everything sensitive comes from .env (gitignored).
 */
export default () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  database: {
    uri: process.env.MONGODB_URI || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    // Consumers get a long-lived token for app auto-login (§3.2.1);
    // admins get a shorter session that times out (§4.2).
    consumerExpiresIn: process.env.JWT_CONSUMER_EXPIRES_IN || '30d',
    adminExpiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '1d',
  },

  // Initial Super Admin, seeded on first boot if none exists (§4.3).
  superAdmin: {
    username: process.env.SUPER_ADMIN_USERNAME || '',
    password: process.env.SUPER_ADMIN_PASSWORD || '',
  },

  // Consumer OTP via Omnichannel SMS (STPL-registered, DLT-compliant)
  // TODO: populate once Omnichannel credentials/domain are confirmed.
  sms: {
    username: process.env.SMS_USERNAME || '',
    password: process.env.SMS_PASSWORD || '',
    domain: process.env.SMS_DOMAIN || '',
    senderId: process.env.SMS_SENDER_ID || '',
    dltContentId: process.env.SMS_DLT_CONTENT_ID || '',
  },

  // Payments via Razorpay (Phase 2 / 4)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Cloudinary image hosting/CDN. Signed uploads keep the secret server-side.
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Allowed origins for CORS (admin panel). Comma-separated.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),
});
