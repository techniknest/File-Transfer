import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  try {
    // Only allow seeding in development OR if no admin exists yet
    await connectDB();

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return NextResponse.json({
        message: 'Admin already exists',
        email: existingAdmin.email,
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@p2ptransfer.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
    });

    return NextResponse.json({
      message: 'Admin created successfully',
      email: admin.email,
      note: 'Change the default password immediately after first login.',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
