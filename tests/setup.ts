process.env.APP_NAME ||= "Surls";
process.env.BASE_URL ||= "http://localhost:3000";
process.env.AUTH_SECRET ||= "test-secret-that-is-long-enough-for-surls";
process.env.DATABASE_URL ||= "postgresql://surls:surls@localhost:5432/surls?schema=public";
process.env.WEBAUTHN_ORIGIN ||= "http://localhost:3000";
process.env.WEBAUTHN_RP_ID ||= "localhost";
