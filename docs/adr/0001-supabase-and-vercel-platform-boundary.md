# Use Supabase for programme custody and Vercel for delivery

OWLDIO MENU uses Supabase Postgres, Auth, and a private Storage bucket as the system of record, while Vercel serves the Vite application. This keeps programme status, administrator access, and original PDFs behind database policies and short-lived signed URLs, while preserving a fast static-first public reader; replacing either provider later is possible through the repository and storage adapters, but would require a deliberate data migration.
