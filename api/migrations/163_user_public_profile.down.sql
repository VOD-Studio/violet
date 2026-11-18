ALTER TABLE users
    DROP CONSTRAINT users_public_reading_preferences_array,
    DROP COLUMN public_reading_preferences,
    DROP COLUMN website,
    DROP COLUMN location;
