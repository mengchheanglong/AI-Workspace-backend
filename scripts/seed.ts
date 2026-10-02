import 'reflect-metadata';
import * as argon2 from 'argon2';
import AppDataSource from '../src/database/data-source';
import { User, SystemRole, ProfessionalRole } from '../src/modules/users/entities/user.entity';

async function seed() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
    throw new Error(
      'Seeding is blocked in production environment. Set FORCE_SEED=true to override.',
    );
  }

  console.log('Connecting to database...');
  await AppDataSource.initialize();

  try {
    const userRepo = AppDataSource.getRepository(User);

    console.log('Ensuring clean demo accounts exist...');
    const defaultPasswordHash = await argon2.hash('Password123!');

    const demoUsers = [
      {
        email: 'codex@example.com',
        displayName: 'codex',
        systemRole: SystemRole.ADMIN,
        professionalRole: ProfessionalRole.PM,
      },
      {
        email: 'claude@example.com',
        displayName: 'claude',
        systemRole: SystemRole.USER,
        professionalRole: ProfessionalRole.DEVELOPER,
      },
    ];

    for (const u of demoUsers) {
      let user = await userRepo.findOneBy({ email: u.email });
      if (!user) {
        user = userRepo.create({
          email: u.email,
          displayName: u.displayName,
          passwordHash: defaultPasswordHash,
          systemRole: u.systemRole,
          professionalRole: u.professionalRole,
          isActive: true,
          mustChangePassword: false,
        });
        await userRepo.save(user);
        console.log(`Created demo user: ${u.displayName} (${u.email}) [${u.systemRole}]`);
      } else {
        user.displayName = u.displayName;
        user.systemRole = u.systemRole;
        user.passwordHash = defaultPasswordHash;
        user.isActive = true;
        await userRepo.save(user);
        console.log(`Updated demo user: ${u.displayName} (${u.email}) [${u.systemRole}]`);
      }
    }

    console.log('Seed completed successfully. No mock workspace data created.');
  } finally {
    await AppDataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
