-- Дешёвые выходные: окна вылета и минимум дневных часов в городе.
ALTER TABLE trip_deals ADD COLUMN out_slot text, ADD COLUMN back_slot text;
CREATE INDEX trip_deals_slots_idx ON trip_deals (weekend, out_slot, back_slot);
DELETE FROM trip_deals; -- старые строки без окон; кэш перезаполнится
ALTER TABLE trip_settings ADD COLUMN out_slots text NOT NULL DEFAULT 'fri_eve,sat_morn', ADD COLUMN back_slots text NOT NULL DEFAULT 'sun_day,sun_eve', ADD COLUMN min_hours integer NOT NULL DEFAULT 20, ADD COLUMN sort text NOT NULL DEFAULT 'value';
