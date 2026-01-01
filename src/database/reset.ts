import { DataSource } from 'typeorm';

async function reset() {
  console.log('🗑️  Resetting database...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5433', 10),
    username: process.env.DB_USERNAME ?? 'admin',
    password: process.env.DB_PASSWORD ?? 'admin123',
    database: process.env.DB_NAME ?? 'mydb',
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('✅ Database connected\n');

  try {
    // Drop tables in correct order (respect foreign keys)
    console.log('🗑️  Dropping tables...');
    
    await dataSource.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('   ✓ Dropped users table');
    
    await dataSource.query('DROP TABLE IF EXISTS orgs CASCADE');
    console.log('   ✓ Dropped orgs table');
    
    await dataSource.query('DROP TABLE IF EXISTS students CASCADE');
    console.log('   ✓ Dropped students table');

    // Drop enum types (important when changing enum values)
    console.log('\n🗑️  Dropping enum types...');
    await dataSource.query('DROP TYPE IF EXISTS users_role_enum CASCADE');
    console.log('   ✓ Dropped users_role_enum type');

    console.log('\n✅ Database reset complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart the app to recreate tables (synchronize: true)');
    console.log('   2. Run: npm run db:seed\n');

  } catch (error) {
    console.error('❌ Reset failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

reset().catch((error) => {
  console.error(error);
  process.exit(1);
});
