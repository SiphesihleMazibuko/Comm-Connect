create unique index if not exists help_listings_ward_name_category_unique_idx
  on public.help_listings (ward_id, lower(btrim(name)), lower(btrim(category)));
