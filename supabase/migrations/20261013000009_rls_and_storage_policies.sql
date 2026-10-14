-- File: supabase/migrations/20261013000009_rls_and_storage_policies.sql
-- Description: Complete Row Level Security policies across all 10 public tables and storage buckets

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eagles_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_sections ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.members TO authenticated;
GRANT SELECT ON public.member_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eagles_id_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.contributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.constitution_versions TO authenticated;
GRANT SELECT ON public.constitution_sections TO authenticated;
GRANT SELECT ON public.member_directory_view TO authenticated;

-- RLS: members
DROP POLICY IF EXISTS "members_read_policy" ON public.members;
CREATE POLICY "members_read_policy" ON public.members
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            auth_user_id = auth.uid() OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "members_self_update_policy" ON public.members;
CREATE POLICY "members_self_update_policy" ON public.members
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND auth_user_id = auth.uid())
    WITH CHECK (public.is_active_member() AND auth_user_id = auth.uid());

-- RLS: member_invitations
DROP POLICY IF EXISTS "invitations_admin_select" ON public.member_invitations;
CREATE POLICY "invitations_admin_select" ON public.member_invitations
    FOR SELECT TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('admin', 'super_admin'));

-- RLS: eagles_id_cards
DROP POLICY IF EXISTS "eagles_id_select" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_select" ON public.eagles_id_cards
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "eagles_id_insert" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_insert" ON public.eagles_id_cards
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND member_id = (public.get_caller_auth()).member_id);

DROP POLICY IF EXISTS "eagles_id_update" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_update" ON public.eagles_id_cards
    FOR UPDATE TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "eagles_id_delete" ON public.eagles_id_cards;
CREATE POLICY "eagles_id_delete" ON public.eagles_id_cards
    FOR DELETE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('admin', 'super_admin'));

-- RLS: announcements
DROP POLICY IF EXISTS "announcements_read_active" ON public.announcements;
CREATE POLICY "announcements_read_active" ON public.announcements
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS "announcements_write_officers" ON public.announcements;
CREATE POLICY "announcements_write_officers" ON public.announcements
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "announcements_update_authors" ON public.announcements;
CREATE POLICY "announcements_update_authors" ON public.announcements
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND (author_id = (public.get_caller_auth()).member_id OR (public.get_caller_auth()).user_role IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "announcements_delete_authors" ON public.announcements;
CREATE POLICY "announcements_delete_authors" ON public.announcements
    FOR DELETE TO authenticated
    USING (public.is_active_member() AND (author_id = (public.get_caller_auth()).member_id OR (public.get_caller_auth()).user_role IN ('admin', 'super_admin')));

-- RLS: attendance_events
DROP POLICY IF EXISTS "events_read_active" ON public.attendance_events;
CREATE POLICY "events_read_active" ON public.attendance_events
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS "events_write_officers" ON public.attendance_events;
CREATE POLICY "events_write_officers" ON public.attendance_events
    FOR ALL TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'));

-- RLS: attendance_records
DROP POLICY IF EXISTS "attendance_read" ON public.attendance_records;
CREATE POLICY "attendance_read" ON public.attendance_records
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "attendance_write_officers" ON public.attendance_records;
CREATE POLICY "attendance_write_officers" ON public.attendance_records
    FOR ALL TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('officer', 'admin', 'super_admin'));

-- RLS: contributions
DROP POLICY IF EXISTS "contributions_read" ON public.contributions;
CREATE POLICY "contributions_read" ON public.contributions
    FOR SELECT TO authenticated
    USING (
        public.is_active_member() AND (
            member_id = (public.get_caller_auth()).member_id OR
            (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "contributions_write_finance" ON public.contributions;
CREATE POLICY "contributions_write_finance" ON public.contributions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "contributions_update_finance" ON public.contributions;
CREATE POLICY "contributions_update_finance" ON public.contributions
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

-- RLS: expenses
DROP POLICY IF EXISTS "expenses_read_finance" ON public.expenses;
CREATE POLICY "expenses_read_finance" ON public.expenses
    FOR SELECT TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "expenses_write_finance" ON public.expenses;
CREATE POLICY "expenses_write_finance" ON public.expenses
    FOR INSERT TO authenticated
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "expenses_update_finance" ON public.expenses;
CREATE POLICY "expenses_update_finance" ON public.expenses
    FOR UPDATE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'))
    WITH CHECK (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

DROP POLICY IF EXISTS "expenses_delete_finance" ON public.expenses;
CREATE POLICY "expenses_delete_finance" ON public.expenses
    FOR DELETE TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('financial_officer', 'admin', 'super_admin'));

-- RLS: audit_logs
DROP POLICY IF EXISTS "audit_logs_read_admins" ON public.audit_logs;
CREATE POLICY "audit_logs_read_admins" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_active_member() AND (public.get_caller_auth()).user_role IN ('admin', 'super_admin'));

-- RLS: constitution_versions & sections
DROP POLICY IF EXISTS "constitution_read_active" ON public.constitution_versions;
CREATE POLICY "constitution_read_active" ON public.constitution_versions
    FOR SELECT TO authenticated
    USING (public.is_active_member());

DROP POLICY IF EXISTS "sections_read_active" ON public.constitution_sections;
CREATE POLICY "sections_read_active" ON public.constitution_sections
    FOR SELECT TO authenticated
    USING (public.is_active_member());

-- Supabase Storage CRUD Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'private-eagles-documents',
    'private-eagles-documents',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png']
) ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "storage_owner_upload" ON storage.objects;
CREATE POLICY "storage_owner_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text
);

DROP POLICY IF EXISTS "storage_owner_and_admin_read" ON storage.objects;
CREATE POLICY "storage_owner_and_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (
        (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text OR
        (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
    )
);

DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
CREATE POLICY "storage_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text
)
WITH CHECK (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text
);

DROP POLICY IF EXISTS "storage_owner_and_admin_delete" ON storage.objects;
CREATE POLICY "storage_owner_and_admin_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'private-eagles-documents' AND
    public.is_active_member() AND
    (storage.foldername(name))[1] = 'eagles-ids' AND
    (
        (storage.foldername(name))[2] = (public.get_caller_auth()).member_id::text OR
        (public.get_caller_auth()).user_role IN ('admin', 'super_admin')
    )
);
