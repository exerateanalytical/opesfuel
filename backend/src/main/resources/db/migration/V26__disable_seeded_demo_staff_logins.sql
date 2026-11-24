-- Launch hardening: the seeded demo staff logins (@opesfuel.cm) must not be claimable in production.
-- The public walkthrough now runs as a separate browser-only demo site, so these backend accounts are not needed.
-- The seeded platform admin row is kept; set its real email with OPESFUEL_BOOTSTRAP_ADMIN_EMAIL.
UPDATE user_accounts
SET status = 'DISABLED'
WHERE id IN ('usr_owner_01', 'usr_manager_01', 'usr_attendant_01', 'usr_accountant_01');
