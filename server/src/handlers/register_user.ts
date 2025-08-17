import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export const registerUser = async (input: RegisterUserInput): Promise<AuthResponse> => {
  try {
    // Check if email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('Email already exists');
    }

    // Hash the password using crypto module
    const salt = randomBytes(16).toString('hex');
    const password_hash = createHash('sha256')
      .update(input.password + salt)
      .digest('hex') + ':' + salt;

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash,
        name: input.name
      })
      .returning()
      .execute();

    const user = result[0];

    // Generate simple token (in production, use proper JWT)
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

    return {
      user,
      token
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
};