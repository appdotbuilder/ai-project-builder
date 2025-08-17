import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser, hashPassword } from '../handlers/login_user';

// Simple token decoder for testing
const decodeToken = (token: string) => {
  const [header, payload, signature] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString()),
    signature
  };
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUser = {
    email: 'test@example.com',
    password: 'testpassword123',
    name: 'Test User'
  };

  it('should login user with valid credentials', async () => {
    // Create test user with hashed password
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable).values({
      email: testUser.email,
      password_hash: hashedPassword,
      name: testUser.name
    }).execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: testUser.password
    };

    const result = await loginUser(loginInput);

    // Verify user data
    expect(result.user.email).toEqual(testUser.email);
    expect(result.user.name).toEqual(testUser.name);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user.updated_at).toBeInstanceOf(Date);
    expect(result.user.password_hash).toEqual(hashedPassword);

    // Verify token
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');

    // Verify token structure and content
    const decoded = decodeToken(result.token);
    expect(decoded.header.alg).toEqual('HS256');
    expect(decoded.header.typ).toEqual('JWT');
    expect(decoded.payload.userId).toEqual(result.user.id);
    expect(decoded.payload.email).toEqual(testUser.email);
    expect(decoded.payload.exp).toBeDefined();
    expect(decoded.payload.iat).toBeDefined();
  });

  it('should throw error for non-existent email', async () => {
    const loginInput: LoginUserInput = {
      email: 'nonexistent@example.com',
      password: 'anypassword'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for incorrect password', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable).values({
      email: testUser.email,
      password_hash: hashedPassword,
      name: testUser.name
    }).execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle empty database gracefully', async () => {
    const loginInput: LoginUserInput = {
      email: 'test@example.com',
      password: 'testpassword'
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should generate different tokens for different login sessions', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable).values({
      email: testUser.email,
      password_hash: hashedPassword,
      name: testUser.name
    }).execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: testUser.password
    };

    const result1 = await loginUser(loginInput);
    
    // Wait a moment to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const result2 = await loginUser(loginInput);

    // Tokens should be different due to different iat (issued at) timestamps
    expect(result1.token).not.toEqual(result2.token);

    // But both should decode to the same user data
    const decoded1 = decodeToken(result1.token);
    const decoded2 = decodeToken(result2.token);

    expect(decoded1.payload.userId).toEqual(decoded2.payload.userId);
    expect(decoded1.payload.email).toEqual(decoded2.payload.email);
    expect(decoded1.payload.iat).not.toEqual(decoded2.payload.iat);
  });

  it('should login with case-sensitive email', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable).values({
      email: testUser.email.toLowerCase(),
      password_hash: hashedPassword,
      name: testUser.name
    }).execute();

    // Try login with different case - should fail since email should be exact match
    const loginInput: LoginUserInput = {
      email: testUser.email.toUpperCase(),
      password: testUser.password
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should preserve user data integrity during login', async () => {
    // Create test user with hashed password
    const hashedPassword = hashPassword(testUser.password);
    const insertResult = await db.insert(usersTable).values({
      email: testUser.email,
      password_hash: hashedPassword,
      name: testUser.name
    }).returning().execute();

    const createdUser = insertResult[0];

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: testUser.password
    };

    const result = await loginUser(loginInput);

    // Verify all user data is preserved exactly
    expect(result.user.id).toEqual(createdUser.id);
    expect(result.user.email).toEqual(createdUser.email);
    expect(result.user.password_hash).toEqual(createdUser.password_hash);
    expect(result.user.name).toEqual(createdUser.name);
    expect(result.user.created_at).toEqual(createdUser.created_at);
    expect(result.user.updated_at).toEqual(createdUser.updated_at);
  });

  it('should reject invalid password hashes', async () => {
    // Create user with malformed password hash
    await db.insert(usersTable).values({
      email: testUser.email,
      password_hash: 'invalid-hash-format',
      name: testUser.name
    }).execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: testUser.password
    };

    await expect(loginUser(loginInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle token expiration correctly', async () => {
    // Create test user
    const hashedPassword = hashPassword(testUser.password);
    await db.insert(usersTable).values({
      email: testUser.email,
      password_hash: hashedPassword,
      name: testUser.name
    }).execute();

    const loginInput: LoginUserInput = {
      email: testUser.email,
      password: testUser.password
    };

    const result = await loginUser(loginInput);
    const decoded = decodeToken(result.token);

    // Check that expiration is set to 24 hours from now
    const expectedExp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    const actualExp = decoded.payload.exp;

    // Allow for small time difference (within 10 seconds)
    expect(Math.abs(actualExp - expectedExp)).toBeLessThan(10);
  });
});