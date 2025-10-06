
-- KOLLEKCIÓ TÍPUSOK
CREATE TABLE collection_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    color VARCHAR(20),
    icon VARCHAR(100),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    collection_type_id INT NOT NULL REFERENCES collection_types(id),
    name VARCHAR(100) NOT NULL,                 -- e.g. "Német kupakok"
    image VARCHAR(100),                         -- optional image URL or filename
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE attributes (
    id SERIAL PRIMARY KEY,
    collection_type_id INT NOT NULL REFERENCES collection_types(id) ON DELETE CASCADE,
    item_options_id INT REFERENCES item_options(id) ON DELETE SET NULL,
    name VARCHAR(20) NOT NULL,   -- pl. "Gyártó"
    data_type TEXT NOT NULL CHECK (data_type IN ('string','number','date','boolean', "select")),
);

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    image VARCHAR(100) NOT NULL,
    acquired_at TIMESTAMP DEFAULT now()
);

CREATE TABLE item_attributes (
    id SERIAL PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    attribute_id INT NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
    value_string TEXT,
    value_number INT,
    value_date DATE,
    value_boolean BOOLEAN,
    UNIQUE(item_id, attribute_id) -- 1 attribútum 1 érték
);

CREATE TABLE item_tags (
    id SERIAL PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag TEXT NOT NULL
);
CREATE INDEX idx_item_tags_tag ON item_tags(tag); -- gyors keresés

CREATE TABLE item_options (
    id SERIAL PRIMARY KEY,                 -- unique id for this set of options
    option_ids TEXT NOT NULL,              -- e.g. "1;2;3"
    option_labels TEXT NOT NULL            -- e.g. "Red;Green;Blue"
);