import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function setSuperAdmin() {
    try {
        const email = (process.env.SUPER_ADMIN_EMAIL || 'munokolive@gmail.com').toLowerCase();
        const password = process.env.SUPER_ADMIN_PASSWORD || '77916407@Mu';

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                nom: 'KOLIVE',
                prenom: 'Muno',
                role: 'SUPER_ADMIN',
                actif: true,
                verified: true
            },
            create: {
                email,
                password: hashedPassword,
                nom: 'KOLIVE',
                prenom: 'Muno',
                role: 'SUPER_ADMIN',
                actif: true,
                verified: true
            },
            select: { id: true, email: true, role: true, actif: true, verified: true }
        });

        const ok = await bcrypt.compare(password, hashedPassword);

        console.log('✅ SUPER ADMIN UPSERT RÉUSSI');
        console.log('   Email:', user.email);
        console.log('   Mot de passe utilisé:', password);
        console.log('   Hash bcrypt vérifié:', ok ? '✅ OUI' : '❌ NON');
        console.log('   Rôle:', user.role, 'Actif:', user.actif, 'Vérifié:', user.verified);
        console.log('   ID:', user.id);
    } catch (error) {
        console.error('❌ Erreur configuration super admin:', error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

setSuperAdmin();

