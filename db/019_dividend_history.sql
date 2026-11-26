CREATE TABLE dividend_history (symbol text PRIMARY KEY, currency char(3), payments jsonb NOT NULL DEFAULT '[]', ok boolean NOT NULL DEFAULT true, fetched_at timestamptz NOT NULL DEFAULT now());
