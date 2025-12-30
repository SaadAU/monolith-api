import { DataSource } from 'typeorm';
import { createHash } from 'crypto';

// Simple password hashing - matches UsersService
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function seed() {
  console.log('🌱 Starting database seed...\n');

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
    // Check if data already exists
    const existingOrgs = await dataSource.query('SELECT COUNT(*) FROM orgs');
    if (parseInt(existingOrgs[0].count) > 0) {
      console.log('⚠️  Data already exists. Skipping seed.\n');
      console.log('   To re-seed, run: npm run db:reset\n');
      await dataSource.destroy();
      return;
    }

    // ============================================
    // ORGANIZATIONS
    // ============================================
    console.log('📁 Creating organizations...');
    
    const orgs = [
      {
        id: '11111111-1111-4111-a111-111111111111',
        name: 'Acme Corporation',
        slug: 'acme-corp',
        description: 'A leading technology company',
        website: 'https://acme.example.com',
        phone: '+1-555-100-1000',
        address: '123 Tech Street, Silicon Valley, CA',
        isActive: true,
      },
      {
        id: '22222222-2222-4222-a222-222222222222',
        name: 'TechStart Inc',
        slug: 'techstart',
        description: 'Innovative startup accelerator',
        website: 'https://techstart.example.com',
        phone: '+1-555-200-2000',
        address: '456 Innovation Ave, Austin, TX',
        isActive: true,
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        name: 'Global Events Ltd',
        slug: 'global-events',
        description: 'Professional event management company',
        website: 'https://globalevents.example.com',
        phone: '+1-555-300-3000',
        address: '789 Event Plaza, New York, NY',
        isActive: true,
      },
    ];

    for (const org of orgs) {
      await dataSource.query(
        `INSERT INTO orgs (id, name, slug, description, website, phone, address, "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [org.id, org.name, org.slug, org.description, org.website, org.phone, org.address, org.isActive]
      );
      console.log(`   ✓ Created org: ${org.name}`);
    }

    // ============================================
    // USERS
    // ============================================
    console.log('\n👤 Creating users...');

    const users = [
      // Acme Corp users
      {
        id: 'aaaa1111-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        name: 'Admin User',
        email: 'admin@acme.com',
        password: 'Admin123!',
        phone: '+1-555-101-0001',
        role: 'admin',
        orgId: '11111111-1111-4111-a111-111111111111',
      },
      {
        id: 'aaaa2222-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        name: 'John Organizer',
        email: 'john@acme.com',
        password: 'Organizer123!',
        phone: '+1-555-101-0002',
        role: 'organizer',
        orgId: '11111111-1111-4111-a111-111111111111',
      },
      {
        id: 'aaaa3333-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        name: 'Jane Member',
        email: 'jane@acme.com',
        password: 'Member123!',
        phone: '+1-555-101-0003',
        role: 'member',
        orgId: '11111111-1111-4111-a111-111111111111',
      },
      // TechStart users
      {
        id: 'bbbb1111-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        name: 'TechStart Admin',
        email: 'admin@techstart.com',
        password: 'Admin123!',
        phone: '+1-555-202-0001',
        role: 'admin',
        orgId: '22222222-2222-4222-a222-222222222222',
      },
      {
        id: 'bbbb2222-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        name: 'Sarah Developer',
        email: 'sarah@techstart.com',
        password: 'Developer123!',
        role: 'member',
        orgId: '22222222-2222-4222-a222-222222222222',
      },
      // Global Events users
      {
        id: 'cccc1111-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Events Manager',
        email: 'manager@globalevents.com',
        password: 'Manager123!',
        phone: '+1-555-303-0001',
        role: 'admin',
        orgId: '33333333-3333-4333-a333-333333333333',
      },
    ];

    for (const user of users) {
      const passwordHash = hashPassword(user.password);
      await dataSource.query(
        `INSERT INTO users (id, name, email, "passwordHash", phone, role, "orgId", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
        [user.id, user.name, user.email, passwordHash, user.phone ?? null, user.role, user.orgId]
      );
      console.log(`   ✓ Created user: ${user.name} (${user.email}) - ${user.role}`);
    }

    // ============================================
    // STUDENTS (optional sample data)
    // ============================================
    console.log('\n🎓 Creating sample students...');

    const students = [
      {
        name: 'Alice Johnson',
        email: 'alice@student.example.com',
        phone: '+1-555-001-0001',
        enrollmentNumber: 'STU-2025-001',
      },
      {
        name: 'Bob Smith',
        email: 'bob@student.example.com',
        phone: '+1-555-001-0002',
        enrollmentNumber: 'STU-2025-002',
      },
      {
        name: 'Charlie Brown',
        email: 'charlie@student.example.com',
        phone: '+1-555-001-0003',
        enrollmentNumber: 'STU-2025-003',
      },
    ];

    for (const student of students) {
      await dataSource.query(
        `INSERT INTO students (id, name, email, phone, "enrollmentNumber", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())`,
        [student.name, student.email, student.phone, student.enrollmentNumber]
      );
      console.log(`   ✓ Created student: ${student.name}`);
    }

    console.log('\n✅ Seed completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   • ${orgs.length} organizations`);
    console.log(`   • ${users.length} users`);
    console.log(`   • ${students.length} students\n`);
    console.log('🔐 Test credentials:');
    console.log('   • admin@acme.com / Admin123!');
    console.log('   • john@acme.com / Organizer123!');
    console.log('   • jane@acme.com / Member123!\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
