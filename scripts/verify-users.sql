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
