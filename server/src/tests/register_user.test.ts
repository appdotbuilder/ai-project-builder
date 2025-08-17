import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput } from '../schema';
import { registerUser } from '../handlers/register_user';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

// Test input with all required fields
const testInput: RegisterUserInput = {
  email: 'test@example.com',
  password: 'testpassword123',
  name: 'Test User'
};

// Helper function to verify password hash
const verifyPassword = (password: string, hashedPassword: string): boolean => {
  const [hash, salt] = hashedPassword.split(':');
  const expectedHash = createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return hash === expectedHash;
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(testInput);

    // Validate user fields
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.name).toEqual('Test User');
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);
    expect(result.user.password_hash).toBeDefined();
    expect(result.user.password_hash).not.toEqual('testpassword123'); // Should be hashed

    // Validate token
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should hash the password correctly', async () => {
    const result = await registerUser(testInput);

    // Verify password is hashed and can be verified
    const isValidPassword = verifyPassword('testpassword123', result.user.password_hash);
    expect(isValidPassword).toBe(true);

    // Verify wrong password fails
    const isInvalidPassword = verifyPassword('wrongpassword', result.user.password_hash);
    expect(isInvalidPassword).toBe(false);
  });

  it('should save user to database', async () => {
    const result = await registerUser(testInput);

    // Query database directly
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].name).toEqual('Test User');
    expect(users[0].created_at).toBeInstanceOf(Date);
  });

  it('should generate valid token', async () => {
    const result = await registerUser(testInput);

    // Verify token can be decoded
    const decoded = JSON.parse(Buffer.from(result.token, 'base64').toString());

    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual(result.user.email);
    expect(decoded.exp).toBeDefined(); // Has expiration
    expect(decoded.exp).toBeGreaterThan(Date.now()); // Not expired
  });

  it('should reject duplicate email registration', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register same email again
    const duplicateInput: RegisterUserInput = {
      email: 'test@example.com',
      password: 'differentpassword',
      name: 'Different User'
    };

    await expect(registerUser(duplicateInput)).rejects.toThrow(/email already exists/i);
  });

  it('should handle different valid email formats', async () => {
    const inputs: RegisterUserInput[] = [
      { email: 'user.with.dots@example.com', password: 'password123', name: 'Dot User' },
      { email: 'user+tag@example.com', password: 'password123', name: 'Plus User' },
      { email: 'user@subdomain.example.com', password: 'password123', name: 'Subdomain User' }
    ];

    for (const input of inputs) {
      const result = await registerUser(input);
      expect(result.user.email).toEqual(input.email);
      expect(result.user.name).toEqual(input.name);
    }

    // Verify all users are in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(3);
  });

  it('should handle minimum password length', async () => {
    const minPasswordInput: RegisterUserInput = {
      email: 'minpass@example.com',
      password: '12345678', // Exactly 8 characters (minimum)
      name: 'Min Password User'
    };

    const result = await registerUser(minPasswordInput);
    expect(result.user.email).toEqual('minpass@example.com');

    // Verify password was hashed properly
    const isValid = verifyPassword('12345678', result.user.password_hash);
    expect(isValid).toBe(true);
  });

  it('should handle long names and emails', async () => {
    const longDataInput: RegisterUserInput = {
      email: 'very.long.email.address.for.testing@example-domain.com',
      password: 'securepassword123',
      name: 'Very Long User Name That Tests Maximum Length Handling'
    };

    const result = await registerUser(longDataInput);
    expect(result.user.email).toEqual(longDataInput.email);
    expect(result.user.name).toEqual(longDataInput.name);
  });

  it('should create unique password hashes for same password', async () => {
    const input1: RegisterUserInput = {
      email: 'user1@example.com',
      password: 'samepassword',
      name: 'User One'
    };

    const input2: RegisterUserInput = {
      email: 'user2@example.com',
      password: 'samepassword',
      name: 'User Two'
    };

    const result1 = await registerUser(input1);
    const result2 = await registerUser(input2);

    // Same password should produce different hashes due to salt
    expect(result1.user.password_hash).not.toEqual(result2.user.password_hash);

    // But both should verify correctly
    expect(verifyPassword('samepassword', result1.user.password_hash)).toBe(true);
    expect(verifyPassword('samepassword', result2.user.password_hash)).toBe(true);
  });

  it('should handle special characters in password', async () => {
    const specialPasswordInput: RegisterUserInput = {
      email: 'special@example.com',
      password: 'p@ssw0rd!#$%^&*()',
      name: 'Special User'
    };

    const result = await registerUser(specialPasswordInput);
    expect(result.user.email).toEqual('special@example.com');

    // Verify password with special characters works
    const isValid = verifyPassword('p@ssw0rd!#$%^&*()', result.user.password_hash);
    expect(isValid).toBe(true);
  });
});