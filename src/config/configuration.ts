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
});




