-- Security policy group: trusted origins/proxies, cookie constraints, session device cap.
-- No default overrides are seeded — deployment env stays authoritative until an admin
-- confirms a change through the pending → confirm flow.
INSERT INTO site_settings_groups (group_name) VALUES ('security')
ON CONFLICT (group_name) DO NOTHING;
