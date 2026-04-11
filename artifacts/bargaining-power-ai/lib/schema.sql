-- Bargaining Power AI schema
-- Runs on the same Postgres instance as CollBar (different table prefix: bp_)

CREATE TABLE IF NOT EXISTS bp_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(20) DEFAULT 'trial' CHECK (plan IN ('trial', 'professional', 'enterprise')),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bp_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bp_org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES bp_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES bp_orgs(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES bp_users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS bp_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES bp_orgs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'complete', 'error')),
  state VARCHAR(2),
  pension_system VARCHAR(50),
  contract_start_year INTEGER,
  contract_end_year INTEGER,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES bp_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bp_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES bp_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES bp_orgs(id) ON DELETE CASCADE,
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(20) CHECK (file_type IN ('cba', 'roster', 'proposal', 'other')),
  file_path VARCHAR(1000) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES bp_users(id),
  processed BOOLEAN DEFAULT FALSE,
  extracted_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bp_cost_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES bp_projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES bp_orgs(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'complete', 'error')),
  assumptions JSONB DEFAULT '{}',
  summary JSONB DEFAULT '{}',
  output_file_path VARCHAR(1000),
  generated_by UUID REFERENCES bp_users(id),
  generation_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bp_projects_org ON bp_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_bp_uploads_project ON bp_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_bp_uploads_org ON bp_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_bp_cost_models_project ON bp_cost_models(project_id);
CREATE INDEX IF NOT EXISTS idx_bp_cost_models_org ON bp_cost_models(organization_id);
CREATE INDEX IF NOT EXISTS idx_bp_org_members_user ON bp_org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_bp_org_members_org ON bp_org_members(organization_id);
