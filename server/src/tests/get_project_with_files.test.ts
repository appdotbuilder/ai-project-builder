import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { getProjectWithFiles } from '../handlers/get_project_with_files';

describe('getProjectWithFiles', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return project with files when user owns the project', async () => {
    // Create a user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    // Create a project
    const [project] = await db.insert(projectsTable)
      .values({
        name: 'Test Project',
        description: 'A test project',
        user_id: user.id,
        metadata: { version: '1.0.0' }
      })
      .returning()
      .execute();

    // Create project files
    const [file1] = await db.insert(projectFilesTable)
      .values({
        project_id: project.id,
        path: '/src/index.ts',
        content: 'console.log("Hello World");',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const [file2] = await db.insert(projectFilesTable)
      .values({
        project_id: project.id,
        path: '/package.json',
        content: '{"name": "test-project"}',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const result = await getProjectWithFiles(project.id, user.id);

    expect(result).not.toBeNull();
    expect(result!.project.id).toEqual(project.id);
    expect(result!.project.name).toEqual('Test Project');
    expect(result!.project.description).toEqual('A test project');
    expect(result!.project.user_id).toEqual(user.id);
    expect(result!.project.metadata).toEqual({ version: '1.0.0' });
    expect(result!.project.created_at).toBeInstanceOf(Date);
    expect(result!.project.updated_at).toBeInstanceOf(Date);

    expect(result!.files).toHaveLength(2);
    
    const indexFile = result!.files.find(f => f.path === '/src/index.ts');
    expect(indexFile).toBeDefined();
    expect(indexFile!.content).toEqual('console.log("Hello World");');
    expect(indexFile!.file_type).toEqual('file');
    expect(indexFile!.project_id).toEqual(project.id);

    const packageFile = result!.files.find(f => f.path === '/package.json');
    expect(packageFile).toBeDefined();
    expect(packageFile!.content).toEqual('{"name": "test-project"}');
    expect(packageFile!.file_type).toEqual('file');
    expect(packageFile!.project_id).toEqual(project.id);
  });

  it('should return null when project does not exist', async () => {
    // Create a user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    const result = await getProjectWithFiles(999, user.id);

    expect(result).toBeNull();
  });

  it('should return null when user does not own the project', async () => {
    // Create two users
    const [user1] = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword',
        name: 'User 1'
      })
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword',
        name: 'User 2'
      })
      .returning()
      .execute();

    // Create a project owned by user1
    const [project] = await db.insert(projectsTable)
      .values({
        name: 'User 1 Project',
        description: 'A project owned by user 1',
        user_id: user1.id
      })
      .returning()
      .execute();

    // Try to access the project as user2
    const result = await getProjectWithFiles(project.id, user2.id);

    expect(result).toBeNull();
  });

  it('should return project with no files when project has no files', async () => {
    // Create a user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    // Create a project with no files
    const [project] = await db.insert(projectsTable)
      .values({
        name: 'Empty Project',
        description: null,
        user_id: user.id,
        metadata: null
      })
      .returning()
      .execute();

    const result = await getProjectWithFiles(project.id, user.id);

    expect(result).not.toBeNull();
    expect(result!.project.id).toEqual(project.id);
    expect(result!.project.name).toEqual('Empty Project');
    expect(result!.project.description).toBeNull();
    expect(result!.project.metadata).toBeNull();
    expect(result!.files).toHaveLength(0);
  });

  it('should handle directory structures with parent-child relationships', async () => {
    // Create a user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    // Create a project
    const [project] = await db.insert(projectsTable)
      .values({
        name: 'Structured Project',
        description: 'A project with directory structure',
        user_id: user.id
      })
      .returning()
      .execute();

    // Create directory structure: /src directory with index.ts inside
    const [srcDir] = await db.insert(projectFilesTable)
      .values({
        project_id: project.id,
        path: '/src',
        content: '',
        file_type: 'directory',
        parent_id: null
      })
      .returning()
      .execute();

    const [indexFile] = await db.insert(projectFilesTable)
      .values({
        project_id: project.id,
        path: '/src/index.ts',
        content: 'export default function main() {}',
        file_type: 'file',
        parent_id: srcDir.id
      })
      .returning()
      .execute();

    const result = await getProjectWithFiles(project.id, user.id);

    expect(result).not.toBeNull();
    expect(result!.files).toHaveLength(2);

    const directory = result!.files.find(f => f.file_type === 'directory');
    expect(directory).toBeDefined();
    expect(directory!.path).toEqual('/src');
    expect(directory!.parent_id).toBeNull();

    const file = result!.files.find(f => f.file_type === 'file');
    expect(file).toBeDefined();
    expect(file!.path).toEqual('/src/index.ts');
    expect(file!.parent_id).toEqual(srcDir.id);
    expect(file!.content).toEqual('export default function main() {}');
  });

  it('should preserve file order and metadata correctly', async () => {
    // Create a user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        name: 'Test User'
      })
      .returning()
      .execute();

    // Create a project
    const [project] = await db.insert(projectsTable)
      .values({
        name: 'Multi-file Project',
        description: 'Testing file ordering',
        user_id: user.id
      })
      .returning()
      .execute();

    // Create multiple files in specific order
    const fileData = [
      { path: '/README.md', content: '# Project README' },
      { path: '/package.json', content: '{"dependencies": {}}' },
      { path: '/src/app.ts', content: 'import express from "express";' }
    ];

    for (const data of fileData) {
      await db.insert(projectFilesTable)
        .values({
          project_id: project.id,
          path: data.path,
          content: data.content,
          file_type: 'file',
          parent_id: null
        })
        .execute();
    }

    const result = await getProjectWithFiles(project.id, user.id);

    expect(result).not.toBeNull();
    expect(result!.files).toHaveLength(3);

    // Verify all files are present with correct content
    const readmeFile = result!.files.find(f => f.path === '/README.md');
    expect(readmeFile).toBeDefined();
    expect(readmeFile!.content).toEqual('# Project README');

    const packageFile = result!.files.find(f => f.path === '/package.json');
    expect(packageFile).toBeDefined();
    expect(packageFile!.content).toEqual('{"dependencies": {}}');

    const appFile = result!.files.find(f => f.path === '/src/app.ts');
    expect(appFile).toBeDefined();
    expect(appFile!.content).toEqual('import express from "express";');

    // Verify all files have proper timestamps
    result!.files.forEach(file => {
      expect(file.created_at).toBeInstanceOf(Date);
      expect(file.updated_at).toBeInstanceOf(Date);
      expect(file.id).toBeDefined();
      expect(file.project_id).toEqual(project.id);
    });
  });
});