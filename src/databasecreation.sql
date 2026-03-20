
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
    role INTEGER NOT NULL,
    summary TEXT,
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
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection_type_id INT NOT NULL REFERENCES collection_types(id),
    name VARCHAR(100) NOT NULL,                 -- e.g. "Német kupakok"
    image VARCHAR(100),                         -- optional image URL or filename
    created_at TIMESTAMP DEFAULT now(),
    description JSONB NOT NULL,
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

    seller_id UUID REFERENCES users(id) ON DELETE SET NULL

    collection_type_id INT NOT NULL
        REFERENCES collection_types(id),

    title TEXT NOT NULL,
    description TEXT NOT NULL,

    money_price NUMERIC(12,2),
    exchange_description TEXT,

    city TEXT NOT NULL,
    delivery_available BOOLEAN DEFAULT false NOT NULL,

    quality_id INT NOT NULL,

    state_id INT NOT NULL,

    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP
);

CREATE TABLE trade_images (
    id SERIAL PRIMARY KEY,
    trade_id INT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    position INT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE trade_followers (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    trade_id INT REFERENCES trades(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),

    PRIMARY KEY (user_id, trade_id)
);

CREATE TABLE trade_chats (
    id UUID PRIMARY KEY,

    trade_id UUID NOT NULL REFERENCES trades(id),
    seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    buyer_id UUID  REFERENCES users(id) ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT now(),

    UNIQUE(trade_id, buyer_id)
);

CREATE TABLE trade_chat_messages (
    id SERIAL PRIMARY KEY,

    chat_id UUID NOT NULL REFERENCES trade_chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),

    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE trade_confirmations (
    id SERIAL PRIMARY KEY,

    trade_id UUID NOT NULL REFERENCES trades(id),

    seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,

    seller_confirmed BOOLEAN DEFAULT false,
    buyer_confirmed BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT now(),
    completed_at TIMESTAMP
);

CREATE TABLE trade_reviews (
    id SERIAL PRIMARY KEY,
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rating BOOLEAN NOT NULL,  -- true = good, false = bad
    comment TEXT,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE (trade_id, reviewer_id)
);

CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    report_type INT NOT NULL, -- e.g., 'spam', 'scam', 'inappropriate_content'
    
    entity_type TEXT NOT NULL, -- e.g., 'trade', 'user', 'message', 'review'
    entity_id TEXT NOT NULL,           -- store INT, UUID, or other IDs as text
    
    description JSONB NOT NULL,         -- rich text explanation

    created_at TIMESTAMP DEFAULT now(),
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP
);