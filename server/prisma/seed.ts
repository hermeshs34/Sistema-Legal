import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('legal123', 10);

  const users = [
    {
      email: 'cmendoza@legaltech.ve',
      name: 'Dr. Carlos Mendoza',
      role: 'consultor_general',
      password
    },
    {
      email: 'atorrealba@legaltech.ve',
      name: 'Lic. Ana Torrealba',
      role: 'abogado_senior',
      password
    },
    {
      email: 'jperez@legaltech.ve',
      name: 'Abg. Jose Perez',
      role: 'abogado_junior',
      password
    }
  ];

  for (const user of users) {
    const exists = await prisma.user.findUnique({ where: { email: user.email } });
    if (!exists) {
      await prisma.user.create({ data: user });
      console.log(`Created user: ${user.email}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
