-- V6: Platform SaaS Super-Admin Tenant Lifecycle Status

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status, created_at DESC);
