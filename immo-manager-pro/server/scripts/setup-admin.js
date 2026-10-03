import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setSuperAdmin() {
    try {
        const email = 'munokolive@gmail.com';
        const password = '77916407@Mu';
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                actif: true,
            },
            create: {
                email,
                password: hashedPassword,
                nom: 'Admin',
                prenom: 'Super',
                role: 'SUPER_ADMIN',
                actif: true,
            }
        });
        
        console.log('Super admin user configured successfully:', user.email);
    } catch (error) {
        console.error('Error configuring super admin:', error);
    } finally {
        await prisma.$disconnect();
    }
}

setSuperAdmin();
