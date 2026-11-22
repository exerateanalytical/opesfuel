-- V16: Public Issued Document Registry for Tamper-Evident QR / Fingerprint Verification

CREATE TABLE IF NOT EXISTS issued_documents (
    fingerprint VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    organization_name VARCHAR(200) NOT NULL,
    doc_type VARCHAR(48) NOT NULL,
    doc_serial VARCHAR(96),
    subject_name VARCHAR(200) NOT NULL,
    sha256_hash VARCHAR(128) NOT NULL,
    issued_by VARCHAR(128),
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_reason VARCHAR(300),
    revoked_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_issued_docs_tenant ON issued_documents (tenant_id, issued_at DESC);
