import { db } from '../db';
import { projectsTable, projectFilesTable } from '../db/schema';
import { type DeploymentRequest } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function deployProject(input: DeploymentRequest, userId: number): Promise<{ message: string; deployment_url?: string }> {
  try {
    // 1. Verify that the project belongs to the authenticated user
    const projects = await db.select()
      .from(projectsTable)
      .where(and(
        eq(projectsTable.id, input.project_id),
        eq(projectsTable.user_id, userId)
      ))
      .execute();

    if (projects.length === 0) {
      throw new Error('Project not found or access denied');
    }

    const project = projects[0];

    // 2. Fetch all project files for packaging
    const projectFiles = await db.select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.project_id, input.project_id))
      .execute();

    if (projectFiles.length === 0) {
      throw new Error('No files found in project - cannot deploy empty project');
    }

    // 3. Simulate deployment process based on environment
    const deploymentUrl = generateDeploymentUrl(project.name, input.environment);
    
    // Simulate deployment time based on project complexity
    const deploymentDelay = Math.min(100 + projectFiles.length * 10, 500);
    await new Promise(resolve => setTimeout(resolve, deploymentDelay));

    // 4. Return deployment success with URL
    return {
      message: `Project "${project.name}" successfully deployed to ${input.environment}`,
      deployment_url: deploymentUrl
    };

  } catch (error) {
    console.error('Project deployment failed:', error);
    throw error;
  }
}

// Helper function to generate deployment URLs based on environment
function generateDeploymentUrl(projectName: string, environment: string): string {
  const slug = projectName.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')  // Replace multiple consecutive dashes with single dash
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
  const timestamp = Date.now().toString(36);
  
  switch (environment) {
    case 'production':
      return `https://${slug}.vercel.app`;
    case 'staging':
      return `https://${slug}-staging-${timestamp}.vercel.app`;
    case 'development':
      return `https://${slug}-dev-${timestamp}.vercel.app`;
    default:
      return `https://${slug}-${environment}.vercel.app`;
  }
}