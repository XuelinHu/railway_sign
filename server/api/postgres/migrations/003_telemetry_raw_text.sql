ALTER TABLE telemetry_records
  ALTER COLUMN raw TYPE TEXT USING raw::text;
