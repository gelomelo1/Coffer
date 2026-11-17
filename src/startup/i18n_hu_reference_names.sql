-- Hungarian names of the reference data (collection types, attributes, item option labels).
-- Requires i18n_reference_names_migration.sql. Idempotent: merges the "hu" entry into the translations JSON.
-- Run with:  docker compose -f docker-compose.dev.yml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < startup/i18n_hu_reference_names.sql
BEGIN;
UPDATE collection_types SET name_translations = name_translations || '{"hu": "Kupak"}'  WHERE name = 'Cap';
UPDATE collection_types SET name_translations = name_translations || '{"hu": "Bélyeg"}' WHERE name = 'Stamp';

UPDATE attributes SET name_translations = name_translations || '{"hu": "Márka"}'     WHERE name = 'Brand';
UPDATE attributes SET name_translations = name_translations || '{"hu": "Jellemzők"}' WHERE name = 'Features';
UPDATE attributes SET name_translations = name_translations || '{"hu": "Évjárat"}'   WHERE name = 'Vintage';

-- Same order as option_labels ("Logo;Flag;Landscape;Coat of arms").
UPDATE item_options SET option_labels_translations = option_labels_translations || '{"hu": "Logó;Zászló;Tájkép;Címer"}'
WHERE option_labels = 'Logo;Flag;Landscape;Coat of arms';
COMMIT;
