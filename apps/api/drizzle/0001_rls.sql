-- Row-level security for tenant tables (plans/05-data-model.md §4, plans/06 §2).
--
-- Tenant-scoped code runs inside withWorkspaceTx(), which does
--   SET LOCAL ROLE app_user; SELECT set_config('app.workspace_id', <id>, true);
-- app_user is not the table owner, so these policies always apply to it: a query that
-- forgets its workspace filter sees zero rows from other workspaces, and inserts or updates
-- for another workspace fail. System-scope code (sign-up, membership checks, seeding,
-- migrations) runs as the owning role and is limited to a few audited modules.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT app_user TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "business_profiles" TO app_user;
--> statement-breakpoint
ALTER TABLE "business_profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "business_profiles_workspace_isolation" ON "business_profiles"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "locations" TO app_user;
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "locations_workspace_isolation" ON "locations"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "opening_hours" TO app_user;
--> statement-breakpoint
ALTER TABLE "opening_hours" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "opening_hours_workspace_isolation" ON "opening_hours"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hours_exceptions" TO app_user;
--> statement-breakpoint
ALTER TABLE "hours_exceptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "hours_exceptions_workspace_isolation" ON "hours_exceptions"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contacts_directory" TO app_user;
--> statement-breakpoint
ALTER TABLE "contacts_directory" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "contacts_directory_workspace_isolation" ON "contacts_directory"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "services" TO app_user;
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "services_workspace_isolation" ON "services"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "policies" TO app_user;
--> statement-breakpoint
ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "policies_workspace_isolation" ON "policies"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "agents" TO app_user;
--> statement-breakpoint
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agents_workspace_isolation" ON "agents"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "agent_versions" TO app_user;
--> statement-breakpoint
ALTER TABLE "agent_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "agent_versions_workspace_isolation" ON "agent_versions"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "channels" TO app_user;
--> statement-breakpoint
ALTER TABLE "channels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "channels_workspace_isolation" ON "channels"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contacts" TO app_user;
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "contacts_workspace_isolation" ON "contacts"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "conversations" TO app_user;
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "conversations_workspace_isolation" ON "conversations"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "messages" TO app_user;
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "messages_workspace_isolation" ON "messages"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "tool_calls" TO app_user;
--> statement-breakpoint
ALTER TABLE "tool_calls" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tool_calls_workspace_isolation" ON "tool_calls"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "actions" TO app_user;
--> statement-breakpoint
ALTER TABLE "actions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "actions_workspace_isolation" ON "actions"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "action_events" TO app_user;
--> statement-breakpoint
ALTER TABLE "action_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "action_events_workspace_isolation" ON "action_events"
  USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
  WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);
