import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPassword() {
  const user = await prisma.user.findUnique({ where: { email: 'munokolive@gmail.com' } });
  if (user) {
    const isMatch = await bcrypt.compare('77916407@Mu', user.password);
    console.log('Password match:', isMatch);
  } else {
    console.log('User not found');
  }
}
testPassword().finally(() => prisma.$disconnect());
