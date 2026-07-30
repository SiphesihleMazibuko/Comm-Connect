alter table public.reports
add column if not exists "otherCategory" text;

comment on column public.reports."otherCategory"
is 'Selected category for other incident reports such as funeral, wedding, or community event.';

notify pgrst, 'reload schema';
