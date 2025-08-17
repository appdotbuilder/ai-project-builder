import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, projectsTable, projectFilesTable } from '../db/schema';
import { type DeploymentRequest } from '../schema';
import { deployProject } from '../handlers/deploy_project';

// Test data setup
const testUser = {
  email: 'deploy@test.com',
  password_hash: 'hashed_password',
  name: 'Deploy User'
};

const testProject = {
  name: 'Test Deployment Project',
  description: 'A project for deployment testing',
  metadata: { framework: 'react', version: '18.0.0' }
};

const testFiles = [
  {
    path: '/package.json',
    content: '{"name": "test-app", "version": "1.0.0"}',
    file_type: 'file' as const,
    parent_id: null
  },
  {
    path: '/src',
    content: '',
    file_type: 'directory' as const,
    parent_id: null
  },
  {
    path: '/src/index.js',
    content: 'console.log("Hello World");',
    file_type: 'file' as const,
    parent_id: null
  }
];

describe('deployProject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should deploy a project successfully', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test project
    const projectResult = await db.insert(projectsTable)
      .values({
        ...testProject,
        user_id: userId
      })
      .returning()
      .execute();
    const projectId = projectResult[0].id;

    // Create test files
    await db.insert(projectFilesTable)
      .values(testFiles.map(file => ({
        ...file,
        project_id: projectId
      })))
      .execute();

    // Test deployment
    const deploymentInput: DeploymentRequest = {
      project_id: projectId,
      environment: 'production',
      deployment_config: { buildCommand: 'npm run build' }
    };

    const result = await deployProject(deploymentInput, userId);

    // Verify deployment result
    expect(result.message).toContain('Test Deployment Project');
    expect(result.message).toContain('successfully deployed to production');
    expect(result.deployment_url).toBeDefined();
    expect(result.deployment_url).toMatch(/^https:\/\/test-deployment-project\.vercel\.app$/);
  });

  it('should generate different URLs for different environments', async () => {
    // Create test user and project
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const projectResult = await db.insert(projectsTable)
      .values({
        ...testProject,
        user_id: userId
      })
      .returning()
      .execute();
    const projectId = projectResult[0].id;

    // Create test files
    await db.insert(projectFilesTable)
      .values([{
        project_id: projectId,
        path: '/index.html',
        content: '<html><body>Test</body></html>',
        file_type: 'file',
        parent_id: null
      }])
      .execute();

    // Test staging deployment
    const stagingResult = await deployProject({
      project_id: projectId,
      environment: 'staging'
    }, userId);

    // Test development deployment
    const devResult = await deployProject({
      project_id: projectId,
      environment: 'development'
    }, userId);

    // Test production deployment
    const prodResult = await deployProject({
      project_id: projectId,
      environment: 'production'
    }, userId);

    // Verify different URL patterns
    expect(stagingResult.deployment_url).toMatch(/staging.*vercel\.app$/);
    expect(devResult.deployment_url).toMatch(/dev.*vercel\.app$/);
    expect(prodResult.deployment_url).toBe('https://test-deployment-project.vercel.app');

    // Ensure staging and dev URLs are different (include timestamps)
    expect(stagingResult.deployment_url).not.toEqual(devResult.deployment_url);
  });

  it('should reject deployment for non-existent project', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const deploymentInput: DeploymentRequest = {
      project_id: 99999, // Non-existent project ID
      environment: 'production'
    };

    await expect(deployProject(deploymentInput, userId))
      .rejects.toThrow(/project not found or access denied/i);
  });

  it('should reject deployment for project belonging to different user', async () => {
    // Create first user and project
    const user1Result = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const user1Id = user1Result[0].id;

    const projectResult = await db.insert(projectsTable)
      .values({
        ...testProject,
        user_id: user1Id
      })
      .returning()
      .execute();
    const projectId = projectResult[0].id;

    // Create second user
    const user2Result = await db.insert(usersTable)
      .values({
        email: 'other@test.com',
        password_hash: 'hashed_password',
        name: 'Other User'
      })
      .returning()
      .execute();
    const user2Id = user2Result[0].id;

    // Try to deploy user1's project as user2
    const deploymentInput: DeploymentRequest = {
      project_id: projectId,
      environment: 'production'
    };

    await expect(deployProject(deploymentInput, user2Id))
      .rejects.toThrow(/project not found or access denied/i);
  });

  it('should reject deployment for empty project (no files)', async () => {
    // Create test user and project
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const projectResult = await db.insert(projectsTable)
      .values({
        ...testProject,
        user_id: userId
      })
      .returning()
      .execute();
    const projectId = projectResult[0].id;

    // Don't add any files to the project

    const deploymentInput: DeploymentRequest = {
      project_id: projectId,
      environment: 'production'
    };

    await expect(deployProject(deploymentInput, userId))
      .rejects.toThrow(/no files found in project/i);
  });

  it('should handle deployment with custom configuration', async () => {
    // Create test user and project
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const projectResult = await db.insert(projectsTable)
      .values({
        ...testProject,
        user_id: userId
      })
      .returning()
      .execute();
    const projectId = projectResult[0].id;

    // Create multiple test files
    const manyFiles = Array.from({ length: 10 }, (_, i) => ({
      project_id: projectId,
      path: `/file${i}.js`,
      content: `console.log("File ${i}");`,
      file_type: 'file' as const,
      parent_id: null
    }));

    await db.insert(projectFilesTable)
      .values(manyFiles)
      .execute();

    const deploymentInput: DeploymentRequest = {
      project_id: projectId,
      environment: 'staging',
      deployment_config: {
        buildCommand: 'npm run build:staging',
        outputDirectory: 'dist',
        nodeVersion: '18'
      }
    };

    const result = await deployProject(deploymentInput, userId);

    expect(result.message).toContain('successfully deployed to staging');
    expect(result.deployment_url).toMatch(/staging.*vercel\.app$/);
  });

  it('should handle special characters in project names for URL generation', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create project with special characters in name
    const projectResult = await db.insert(projectsTable)
      .values({
        name: 'My Awesome App! @#$%',
        description: 'Project with special chars',
        user_id: userId
      })
      .returning()
      .execute();
    const projectId = projectResult[0].id;

    // Create test file
    await db.insert(projectFilesTable)
      .values([{
        project_id: projectId,
        path: '/app.js',
        content: 'console.log("Special chars");',
        file_type: 'file',
        parent_id: null
      }])
      .execute();

    const result = await deployProject({
      project_id: projectId,
      environment: 'production'
    }, userId);

    // URL should sanitize special characters
    expect(result.deployment_url).toBe('https://my-awesome-app.vercel.app');
    expect(result.message).toContain('My Awesome App! @#$%');
  });
});