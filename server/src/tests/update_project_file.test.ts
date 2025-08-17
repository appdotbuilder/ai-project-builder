import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { type UpdateProjectFileInput } from '../schema';
import { updateProjectFile } from '../handlers/update_project_file';
import { eq } from 'drizzle-orm';

describe('updateProjectFile', () => {
  let testUser: any;
  let testProject: any;
  let testFile: any;
  let anotherUser: any;
  let anotherProject: any;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        name: 'Test User'
      })
      .returning()
      .execute();
    testUser = userResult[0];

    // Create another user for access control tests
    const anotherUserResult = await db.insert(usersTable)
      .values({
        email: 'another@example.com',
        password_hash: 'hashed_password',
        name: 'Another User'
      })
      .returning()
      .execute();
    anotherUser = anotherUserResult[0];

    // Create test project
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'Test Project',
        description: 'A test project',
        user_id: testUser.id
      })
      .returning()
      .execute();
    testProject = projectResult[0];

    // Create another project for conflict tests
    const anotherProjectResult = await db.insert(projectsTable)
      .values({
        name: 'Another Project',
        description: 'Another test project',
        user_id: anotherUser.id
      })
      .returning()
      .execute();
    anotherProject = anotherProjectResult[0];

    // Create test file
    const fileResult = await db.insert(projectFilesTable)
      .values({
        project_id: testProject.id,
        path: '/src/index.ts',
        content: 'console.log("Hello, World!");',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();
    testFile = fileResult[0];
  });

  afterEach(resetDB);

  it('should update file content successfully', async () => {
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      content: 'console.log("Updated content");'
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.content).toEqual('console.log("Updated content");');
    expect(result.path).toEqual('/src/index.ts'); // Should remain unchanged
    expect(result.file_type).toEqual('file'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at > testFile.updated_at).toBe(true);
  });

  it('should update file path successfully', async () => {
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      path: '/src/main.ts'
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.path).toEqual('/src/main.ts');
    expect(result.content).toEqual('console.log("Hello, World!");'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update multiple fields simultaneously', async () => {
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      path: '/src/app.ts',
      content: 'export default function App() { return <div>Hello</div>; }',
      file_type: 'file'
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.path).toEqual('/src/app.ts');
    expect(result.content).toEqual('export default function App() { return <div>Hello</div>; }');
    expect(result.file_type).toEqual('file');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update parent_id to create hierarchy', async () => {
    // Create a parent directory
    const parentResult = await db.insert(projectFilesTable)
      .values({
        project_id: testProject.id,
        path: '/src',
        content: '',
        file_type: 'directory',
        parent_id: null
      })
      .returning()
      .execute();
    const parentDir = parentResult[0];

    const input: UpdateProjectFileInput = {
      id: testFile.id,
      parent_id: parentDir.id
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.parent_id).toEqual(parentDir.id);
    expect(result.path).toEqual('/src/index.ts'); // Should remain unchanged
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set parent_id to null', async () => {
    // First create a valid parent directory
    const parentResult = await db.insert(projectFilesTable)
      .values({
        project_id: testProject.id,
        path: '/temp-parent',
        content: '',
        file_type: 'directory',
        parent_id: null
      })
      .returning()
      .execute();
    const parentDir = parentResult[0];

    // Set the file to have this parent
    await db.update(projectFilesTable)
      .set({ parent_id: parentDir.id })
      .where(eq(projectFilesTable.id, testFile.id))
      .execute();

    // Now update to set parent_id to null
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      parent_id: null
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.parent_id).toBeNull();
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save changes to database', async () => {
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      content: 'Updated database content',
      path: '/src/updated.ts'
    };

    await updateProjectFile(input, testUser.id);

    // Verify changes were saved to database
    const savedFiles = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.id, testFile.id))
      .execute();

    expect(savedFiles).toHaveLength(1);
    expect(savedFiles[0].content).toEqual('Updated database content');
    expect(savedFiles[0].path).toEqual('/src/updated.ts');
    expect(savedFiles[0].updated_at).toBeInstanceOf(Date);
    expect(savedFiles[0].updated_at > testFile.updated_at).toBe(true);
  });

  it('should throw error when file does not exist', async () => {
    const input: UpdateProjectFileInput = {
      id: 99999, // Non-existent file ID
      content: 'Some content'
    };

    expect(async () => {
      await updateProjectFile(input, testUser.id);
    }).toThrow(/File not found or access denied/i);
  });

  it('should throw error when user does not own the project', async () => {
    // Create file in another user's project
    const anotherFileResult = await db.insert(projectFilesTable)
      .values({
        project_id: anotherProject.id,
        path: '/src/other.ts',
        content: 'Other content',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();
    const anotherFile = anotherFileResult[0];

    const input: UpdateProjectFileInput = {
      id: anotherFile.id,
      content: 'Trying to update'
    };

    expect(async () => {
      await updateProjectFile(input, testUser.id);
    }).toThrow(/File not found or access denied/i);
  });

  it('should throw error when path conflicts with existing file', async () => {
    // Create another file with a different path
    const anotherFileResult = await db.insert(projectFilesTable)
      .values({
        project_id: testProject.id,
        path: '/src/config.ts',
        content: 'Config content',
        file_type: 'file',
        parent_id: null
      })
      .returning()
      .execute();

    const input: UpdateProjectFileInput = {
      id: testFile.id,
      path: '/src/config.ts' // This path already exists
    };

    expect(async () => {
      await updateProjectFile(input, testUser.id);
    }).toThrow(/A file with this path already exists in the project/i);
  });

  it('should allow updating to same path', async () => {
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      path: '/src/index.ts', // Same path as current
      content: 'Updated content'
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.path).toEqual('/src/index.ts');
    expect(result.content).toEqual('Updated content');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should handle empty content update', async () => {
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      content: ''
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.content).toEqual('');
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update file_type from file to directory', async () => {
    const input: UpdateProjectFileInput = {
      id: testFile.id,
      file_type: 'directory',
      content: '' // Directories typically have empty content
    };

    const result = await updateProjectFile(input, testUser.id);

    expect(result.id).toEqual(testFile.id);
    expect(result.file_type).toEqual('directory');
    expect(result.content).toEqual('');
    expect(result.updated_at).toBeInstanceOf(Date);
  });
});