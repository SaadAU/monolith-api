export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  environment: process.env.NODE_ENV ?? 'development',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5433', 10),
    username: process.env.DB_USERNAME ?? 'admin',
    password: process.env.DB_PASSWORD ?? 'admin123',
    name: process.env.DB_NAME ?? 'mydb',
  },
  jwt: {
    secret:
      process.env.JWT_SECRET ??
      'your-super-secret-key-change-in-production-min-32-chars',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '86400', 10), // 24 hours in seconds
  },
});
