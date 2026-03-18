
-- KOLLEKCIÓ TÍPUSOK

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    provider_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    country VARCHAR(20) NOT NULL,
    avatar TEXT,
    role INTEGER NOT NULL
);

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
    data_type INT,
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

CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    liked BOOLEAN NOT NULL DEFAULT FALSE,
    rarity INT CHECK (rarity BETWEEN 1 AND 5),
    UNIQUE (user_id, item_id) -- prevent duplicate reactions per user-item pair
);

CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    followed_at TIMESTAMP DEFAULT now(),
    UNIQUE (user_id, collection_id) -- prevent duplicate follows
);

CREATE TABLE user_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL CHECK (
        platform IN ('Phone', 'Facebook', 'Instagram')
    ),
    value TEXT NOT NULL,
    link TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (user_id, platform)
);

CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    want_description TEXT,               -- what they want in return (text)
    money_requested NUMERIC(10,2),       -- optional money value
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE trade_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    UNIQUE (trade_id, item_id)
);

CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    money_offer NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'rejected', 'accepted', 'revertByCreator', 'revertByOfferer', 'traded')
    ),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE (trade_id, user_id)             -- one offer per user per trade
);

CREATE TABLE offer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    UNIQUE (offer_id, item_id)
);

CREATE TABLE trade_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating BOOLEAN NOT NULL,  -- true = good, false = bad
    comment TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (trade_id, reviewer_id)
);