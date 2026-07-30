alter table public.reports
add column if not exists "crimeCategory" text;

comment on column public.reports."crimeCategory"
is 'Selected crime category for crime incident reports.';

notify pgrst, 'reload schema';
