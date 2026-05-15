-- Upsert all team members: insert if new, update active/role/name if existing.
-- Uses gen_random_uuid() for new rows since cuid() is not a PG native function.
INSERT INTO "User" (id, email, name, role, active, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'caleb@oakridgeelectrical.com',   'Caleb Drouin',    'OFFICE'::"Role", true, NOW(), NOW()),
  (gen_random_uuid()::text, 'sam@oakridgeelectrical.com',     'Sam Cosme',       'ADMIN'::"Role",  true, NOW(), NOW()),
  (gen_random_uuid()::text, 'beth@oakridgeelectrical.com',    'Beth Marceau',    'ADMIN'::"Role",  true, NOW(), NOW()),
  (gen_random_uuid()::text, 'steve@oakridgeelectrical.com',   'Steven Haradon',  'OFFICE'::"Role", true, NOW(), NOW()),
  (gen_random_uuid()::text, 'michael@oakridgeelectrical.com', 'Michael Huggins', 'FIELD'::"Role",  true, NOW(), NOW()),
  (gen_random_uuid()::text, 'tyler@oakridgeelectrical.com',   'Tyler Staiti',    'FIELD'::"Role",  true, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  active     = true,
  role       = EXCLUDED.role,
  name       = EXCLUDED.name,
  "updatedAt" = NOW();

-- Verify results
SELECT email, name, role, active FROM "User"
WHERE email IN (
  'caleb@oakridgeelectrical.com',
  'sam@oakridgeelectrical.com',
  'beth@oakridgeelectrical.com',
  'steve@oakridgeelectrical.com',
  'michael@oakridgeelectrical.com',
  'tyler@oakridgeelectrical.com'
)
ORDER BY email;
