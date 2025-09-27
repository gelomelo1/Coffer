
-- KOLLEKCIÓ TÍPUSOK
CREATE TABLE collection_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    color VARCHAR(20),
    icon VARCHAR(100),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id)
    collection_type_id INT NOT NULL REFERENCES collection_types(id),
    name VARCHAR(100) NOT NULL,                 -- e.g. "Német kupakok"
    image VARCHAR(100),                         -- optional image URL or filename
    created_at TIMESTAMP DEFAULT now()
);