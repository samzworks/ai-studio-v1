-- Performance optimization indexes for frequently queried columns
-- These indexes should improve query performance for credit and pricing operations

-- Index for credit transactions by user and date (for transaction history)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_date 
ON credit_transactions(user_id, created_at DESC);

-- Index for user credits lookup (fast balance checks)
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id 
ON user_credits(user_id);

-- Index for active pricing rules (fast pricing calculations)
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active_type_value 
ON pricing_rules(is_active, feature_type, feature_value) 
WHERE is_active = true;

-- Index for image queries by owner and visibility
CREATE INDEX IF NOT EXISTS idx_images_owner_public 
ON images(owner_id, is_public);

-- Index for favorites by user
CREATE INDEX IF NOT EXISTS idx_favorites_user_id 
ON favorites(user_id);

-- Index for site settings by key (config lookups)
CREATE INDEX IF NOT EXISTS idx_site_settings_key 
ON site_settings(key);

-- Index for user subscription status
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status 
ON user_subscriptions(user_id, status);