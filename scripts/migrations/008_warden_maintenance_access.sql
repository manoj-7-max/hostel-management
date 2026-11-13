INSERT INTO app_role_permission(role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM app_role r CROSS JOIN app_permission p
WHERE r.role_key='warden' AND p.permission_key='maintenance.manage'
ON CONFLICT DO NOTHING;
