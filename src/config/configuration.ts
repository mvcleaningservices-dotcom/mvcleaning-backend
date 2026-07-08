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
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Consumer OTP via MSG91 (Phase 1)
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY || '',
    senderId: process.env.MSG91_SENDER_ID || '',
    templateId: process.env.MSG91_TEMPLATE_ID || '',
  },

  // Payments via Razorpay (Phase 2 / 4)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Allowed origins for CORS (admin panel). Comma-separated.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),
});
