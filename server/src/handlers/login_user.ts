import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

// Simple JWT-like token generation using crypto module
const generateToken = (payload: { userId: number; email: string }): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadWithExp = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iat: Math.floor(Date.now() / 1000)
  };
  const payloadStr = Buffer.from(JSON.stringify(payloadWithExp)).toString('base64url');
  
  const secret = process.env['JWT_SECRET'] || 'fallback-secret-for-testing';
  const signature = createHash('sha256')
    .update(`${header}.${payloadStr}.${secret}`)
    .digest('base64url');
  
  return `${header}.${payloadStr}.${signature}`;
};

// Simple password verification using pbkdf2
const verifyPassword = (password: string, hashedPassword: string): boolean => {
  try {
    const [salt, hash] = hashedPassword.split(':');
    if (!salt || !hash) return false;
    
    const derivedHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const expectedHash = Buffer.from(hash, 'hex');
    const actualHash = Buffer.from(derivedHash, 'hex');
    
    return expectedHash.length === actualHash.length && 
           timingSafeEqual(expectedHash, actualHash);
  } catch (error) {
    return false;
  }
};

// Hash password function for creating test users
export const hashPassword = (password: string): string => {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

export const loginUser = async (input: LoginUserInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = verifyPassword(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash,
        name: user.name,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
};