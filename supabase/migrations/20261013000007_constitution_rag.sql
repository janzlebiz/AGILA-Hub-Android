-- File: supabase/migrations/20261013000007_constitution_rag.sql
-- Description: Constitution versions, sections with pgvector embedding, HNSW cosine index, and server-enforced 0.68 similarity threshold floor

CREATE TABLE IF NOT EXISTS public.constitution_versions (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    version_tag VARCHAR(50) NOT NULL UNIQUE,
    effective_date DATE,
    source_url TEXT NOT NULL,
    source_sha256 VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.constitution_sections (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.constitution_versions(id) ON DELETE CASCADE,
    chapter_number INT,
    chapter_title VARCHAR(255),
    article_number INT NOT NULL,
    article_title VARCHAR(255) NOT NULL,
    section_number INT NOT NULL,
    section_title VARCHAR(255),
    content TEXT NOT NULL,
    chunk_index INT NOT NULL DEFAULT 0,
    token_count INT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_constitution_embedding_hnsw 
ON public.constitution_sections 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE OR REPLACE FUNCTION public.match_constitution_sections(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.68,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    chapter_number INT,
    chapter_title VARCHAR,
    article_number INT,
    article_title VARCHAR,
    section_number INT,
    section_title VARCHAR,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_enforced_threshold FLOAT;
    v_clamped_count INT;
BEGIN
    IF NOT (public.is_active_member()) THEN
        RAISE EXCEPTION 'Access Denied: Inactive or unauthenticated account.';
    END IF;

    -- SERVER-ENFORCED THRESHOLD FLOOR: Clients CANNOT lower threshold below 0.68
    v_enforced_threshold := GREATEST(0.68, LEAST(1.00, COALESCE(match_threshold, 0.68)));
    v_clamped_count := GREATEST(1, LEAST(10, COALESCE(match_count, 5)));

    RETURN QUERY
    SELECT 
        cs.id,
        cs.chapter_number,
        cs.chapter_title,
        cs.article_number,
        cs.article_title,
        cs.section_number,
        cs.section_title,
        cs.content,
        (1 - (cs.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.constitution_sections cs
    JOIN public.constitution_versions cv ON cv.id = cs.version_id
    WHERE cv.is_active = TRUE
      AND (1 - (cs.embedding <=> query_embedding)) >= v_enforced_threshold
    ORDER BY cs.embedding <=> query_embedding ASC
    LIMIT v_clamped_count;
END;
$$;

REVOKE ALL ON FUNCTION public.match_constitution_sections(vector, FLOAT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_constitution_sections(vector, FLOAT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_constitution_sections(vector, FLOAT, INT) TO authenticated;
