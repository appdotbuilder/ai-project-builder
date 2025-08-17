import { serial, text, pgTable, timestamp, integer, json, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for file types
export const fileTypeEnum = pgEnum('file_type', ['file', 'directory']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Projects table
export const projectsTable = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // Nullable
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  metadata: json('metadata'), // Flexible JSON structure for additional project data
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Project files table - represents the codebase structure
export const projectFilesTable = pgTable('project_files', {
  id: serial('id').primaryKey(),
  project_id: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  path: text('path').notNull(), // File path within the project
  content: text('content').notNull(), // File content
  file_type: fileTypeEnum('file_type').notNull(),
  parent_id: integer('parent_id').references((): any => projectFilesTable.id), // Self-referencing for directory hierarchy
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  projects: many(projectsTable),
}));

export const projectsRelations = relations(projectsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [projectsTable.user_id],
    references: [usersTable.id],
  }),
  files: many(projectFilesTable),
}));

export const projectFilesRelations = relations(projectFilesTable, ({ one, many }) => ({
  project: one(projectsTable, {
    fields: [projectFilesTable.project_id],
    references: [projectsTable.id],
  }),
  parent: one(projectFilesTable, {
    fields: [projectFilesTable.parent_id],
    references: [projectFilesTable.id],
    relationName: 'parent_child',
  }),
  children: many(projectFilesTable, {
    relationName: 'parent_child',
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Project = typeof projectsTable.$inferSelect;
export type NewProject = typeof projectsTable.$inferInsert;

export type ProjectFile = typeof projectFilesTable.$inferSelect;
export type NewProjectFile = typeof projectFilesTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  projects: projectsTable,
  projectFiles: projectFilesTable,
};