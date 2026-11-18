ALTER TABLE users
    ADD COLUMN location varchar(100) NOT NULL DEFAULT '',
    ADD COLUMN website text NOT NULL DEFAULT '',
    ADD COLUMN public_reading_preferences jsonb NOT NULL DEFAULT '[]'::jsonb,
    ADD CONSTRAINT users_public_reading_preferences_array CHECK (
        jsonb_typeof(public_reading_preferences) = 'array'
        AND jsonb_array_length(public_reading_preferences) <= 8
    );
