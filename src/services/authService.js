import { userRepository } from '@/repositories/userRepository';
import bcrypt from 'bcryptjs';

class AuthService {
  async registerUser({ name, email, password }) {
    if (!name || !email || !password) {
      throw new Error('All fields are required');
    }

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const role = (adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) ? 'admin' : 'user';

    const user = await userRepository.create({
      name,
      email,
      password: hashedPassword,
      role
    });

    return {
      message: 'User created successfully',
      userId: user._id.toString()
    };
  }

  async verifyCredentials(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('No user found');
    }

    if (user.status === 'suspended') {
      throw new Error('Your account has been suspended. Please contact the administrator.');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    // Auto-promote if email matches ADMIN_EMAIL env variable
    const adminEmail = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    let currentRole = user.role;
    if (adminEmail && user.email.toLowerCase() === adminEmail.toLowerCase() && user.role !== 'admin') {
      currentRole = 'admin';
      user.role = 'admin';
    }

    // Update login count and last login timestamp
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLoginAt = new Date();
    await user.save();

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: currentRole
    };
  }
}

export const authService = new AuthService();
