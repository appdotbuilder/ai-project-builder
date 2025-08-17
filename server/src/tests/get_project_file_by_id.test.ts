import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { getProjectFileById } from '../handlers/get_project_file_by_id';

describe('getProjectFileById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let otherUserId: number;
  let testProjectId: number;
  let otherProjectId: number;
  let testFileId: number;
  let directoryId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash: 'hashed_password',
          name: 'Test User'
        },
        {
          email: 'other@example.com',
          password_hash: 'other_hashed_password',
          name: 'Other User'
        }
      ])
      .returning()
      .execute();

    testUserId = users[0].id;
    otherUserId = users[1].id;

    // Create test projects
    const projects = await db.insert(projectsTable)
      .values([
        {
          name: 'Test Project',
          description: 'A test project',
          user_id: testUserId,
          metadata: { type: 'web' }
        },
        {
          name: 'Other Project',
          description: 'Another project',
          user_id: otherUserId,
          metadata: { type: 'mobile' }
        }
      ])
      .returning()
      .execute();

    testProjectId = projects[0].id;
    otherProjectId = projects[1].id;

    // Create test files
    const files = await db.insert(projectFilesTable)
      .values([
        {
          project_id: testProjectId,
          path: '/src/index.ts',
          content: 'console.log("Hello World");',
          file_type: 'file',
          parent_id: null
        },
        {
          project_id: testProjectId,
          path: '/src',
          content: '',
          file_type: 'directory',
          parent_id: null
        }
      ])
      .returning()
      .execute();

    testFileId = files[0].id;
    directoryId = files[1].id;
  });

  it('should return file when user owns the project', async () => {
    const result = await getProjectFileById(testFileId, testUserId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(testFileId);
    expect(result!.project_id).toBe(testProjectId);
    expect(result!.path).toBe('/src/index.ts');
    expect(result!.content).toBe('console.log("Hello World");');
    expect(result!.file_type).toBe('file');
    expect(result!.parent_id).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return directory when user owns the project', async () => {
    const result = await getProjectFileById(directoryId, testUserId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(directoryId);
    expect(result!.project_id).toBe(testProjectId);
    expect(result!.path).toBe('/src');
    expect(result!.content).toBe('');
    expect(result!.file_type).toBe('directory');
    expect(result!.parent_id).toBeNull();
  });

  it('should return null when user does not own the project', async () => {
    const result = await getProjectFileById(testFileId, otherUserId);

    expect(result).toBeNull();
  });

  it('should return null when file does not exist', async () => {
    const nonExistentFileId = 99999;
    const result = await getProjectFileById(nonExistentFileId, testUserId);

    expect(result).toBeNull();
  });

  it('should return null when user does not exist', async () => {
    const nonExistentUserId = 99999;
    const result = await getProjectFileById(testFileId, nonExistentUserId);

    expect(result).toBeNull();
  });

  it('should handle files with parent relationships', async () => {
    // Create a nested file structure
    const nestedFile = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src/components/Button.tsx',
        content: 'export const Button = () => <button>Click me</button>;',
        file_type: 'file',
        parent_id: directoryId
      })
      .returning()
      .execute();

    const result = await getProjectFileById(nestedFile[0].id, testUserId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(nestedFile[0].id);
    expect(result!.path).toBe('/src/components/Button.tsx');
    expect(result!.content).toBe('export const Button = () => <button>Click me</button>;');
    expect(result!.file_type).toBe('file');
    expect(result!.parent_id).toBe(directoryId);
  });

  it('should handle file with complex content and metadata', async () => {
    // Create a more complex file
    const complexContent = `
import React from 'react';
import { useState, useEffect } from 'react';

interface Props {
  title: string;
  data: any[];
}

export const ComplexComponent: React.FC<Props> = ({ title, data }) => {
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => setLoading(false), 1000);
  }, []);

  return (
    <div>
      <h1>{title}</h1>
      {loading ? <p>Loading...</p> : <ul>{data.map(item => <li key={item.id}>{item.name}</li>)}</ul>}
    </div>
  );
};
    `.trim();

    const complexFile = await db.insert(projectFilesTable)
      .values({
        project_id: testProjectId,
        path: '/src/components/ComplexComponent.tsx',
        content: complexContent,
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const result = await getProjectFileById(complexFile[0].id, testUserId);

    expect(result).not.toBeNull();
    expect(result!.content).toBe(complexContent);
    expect(result!.content).toContain('React.FC<Props>');
    expect(result!.content).toContain('useState');
    expect(result!.content).toContain('useEffect');
  });

  it('should verify authorization for different project ownership scenarios', async () => {
    // Create file in other user's project
    const otherUserFile = await db.insert(projectFilesTable)
      .values({
        project_id: otherProjectId,
        path: '/app.js',
        content: 'console.log("Other user file");',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    // Test user should not access other user's file
    const unauthorizedResult = await getProjectFileById(otherUserFile[0].id, testUserId);
    expect(unauthorizedResult).toBeNull();

    // Other user should access their own file
    const authorizedResult = await getProjectFileById(otherUserFile[0].id, otherUserId);
    expect(authorizedResult).not.toBeNull();
    expect(authorizedResult!.content).toBe('console.log("Other user file");');
  });
});