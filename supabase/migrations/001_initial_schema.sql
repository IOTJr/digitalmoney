-- Trixie Subscription Platform - Initial Schema
-- This migration creates the foundation for the Pay-to-Register workflow

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create subscription tiers enum
CREATE TYPE subscription_tier AS ENUM ('basic', 'expanded', 'exclusive');

-- ============================================
-- PENDING REGISTRATIONS TABLE
-- Stores users who have paid but not yet registered
-- ============================================
CREATE TABLE IF NOT EXISTS public.pending_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    dodo_checkout_id TEXT NOT NULL,
    tier_level subscription_tier NOT NULL DEFAULT 'basic',
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Ensure email is valid
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for faster lookups by email
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON public.pending_registrations(email);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires_at ON public.pending_registrations(expires_at);

-- Index for completed status
CREATE INDEX IF NOT EXISTS idx_pending_registrations_is_completed ON public.pending_registrations(is_completed);

-- ============================================
-- USERS TABLE (extends Supabase Auth)
-- Additional user profile data
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- Tracks active subscriptions for users
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tier subscription_tier NOT NULL DEFAULT 'basic',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    dodo_subscription_id TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one active subscription per user
    CONSTRAINT one_active_subscription_per_user EXCLUDE USING gist (
        user_id WITH =,
        tsrange(created_at, COALESCE(canceled_at, 'infinity')) WITH &&
    ) WHERE (status = 'active')
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Index for period end (for renewal reminders)
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end) WHERE status = 'active';

-- ============================================
-- PAYMENT HISTORY TABLE
-- Tracks all payment events
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    email TEXT NOT NULL, -- Store email for pending registrations
    dodo_checkout_id TEXT NOT NULL,
    dodo_payment_id TEXT,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    tier subscription_tier NOT NULL,
    payment_method TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user payment history
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history(user_id);

-- Index for checkout ID lookups (webhook verification)
CREATE INDEX IF NOT EXISTS idx_payment_history_checkout_id ON public.payment_history(dodo_checkout_id);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_payment_history_email ON public.payment_history(email);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Pending Registrations Policies
-- Allow anyone to check if their email has a pending registration (for registration guard)
CREATE POLICY "Allow email check for pending registration" ON public.pending_registrations
    FOR SELECT USING (
        email = current_setting('request.headers')::json->>'x-check-email'
        OR is_completed = false
    );

-- Allow service role to insert/update pending registrations (webhook)
CREATE POLICY "Service role can manage pending registrations" ON public.pending_registrations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User Profiles Policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Service role can manage user profiles
CREATE POLICY "Service role can manage user profiles" ON public.user_profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Subscriptions Policies
-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage subscriptions
CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Payment History Policies
-- Users can view their own payment history
CREATE POLICY "Users can view own payment history" ON public.payment_history
    FOR SELECT USING (auth.uid() = user_id OR email = (SELECT email FROM user_profiles WHERE id = auth.uid()));

-- Service role can manage payment history
CREATE POLICY "Service role can manage payment history" ON public.payment_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile after auth signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check if email has valid pending registration
CREATE OR REPLACE FUNCTION public.check_pending_registration(check_email TEXT)
RETURNS TABLE (
    has_pending BOOLEAN,
    tier_level subscription_tier,
    checkout_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN pr.id IS NOT NULL THEN true ELSE false END as has_pending,
        pr.tier_level,
        pr.dodo_checkout_id
    FROM public.pending_registrations pr
    WHERE pr.email = check_email
        AND pr.is_completed = false
        AND pr.expires_at > NOW()
    LIMIT 1;
    
    -- If no valid pending registration found, return defaults
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::subscription_tier, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete pending registration
CREATE OR REPLACE FUNCTION public.complete_pending_registration(registration_email TEXT, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    pending_id UUID;
BEGIN
    -- Find the pending registration
    SELECT id INTO pending_id
    FROM public.pending_registrations
    WHERE email = registration_email
        AND is_completed = false
        AND expires_at > NOW()
    LIMIT 1;
    
    IF pending_id IS NOT NULL THEN
        -- Mark as completed
        UPDATE public.pending_registrations
        SET is_completed = true
        WHERE id = pending_id;
        
        -- Create subscription
        INSERT INTO public.subscriptions (user_id, tier, status, dodo_subscription_id, current_period_end)
        SELECT 
            user_uuid,
            pr.tier_level,
            'active',
            pr.dodo_checkout_id,
            NOW() + INTERVAL '1 month' -- First billing period
        FROM public.pending_registrations pr
        WHERE pr.id = pending_id;
        
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired pending registrations (run via cron or on-demand)
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_registrations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.pending_registrations
    WHERE expires_at < NOW()
        AND is_completed = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INSERT DEFAULT PRICING TIERS (for reference)
-- ============================================
-- This is a reference table for pricing information
CREATE TABLE IF NOT EXISTS public.pricing_tiers (
    tier subscription_tier PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    features JSONB NOT NULL DEFAULT '[]',
    display_order INTEGER NOT NULL
);

-- Insert pricing tier data
INSERT INTO public.pricing_tiers (tier, name, price_monthly, features, display_order) VALUES
    ('basic', 'Basic', 15.00, '["Access to basic content", "Community discussion", "Announcements"]'::jsonb, 1),
    ('expanded', 'Expanded', 30.00, '["Everything in Basic", "File downloads (PDF, ZIP)", "Extended content library"]'::jsonb, 2),
    ('exclusive', 'Exclusive', 50.00, '["Everything in Expanded", "Video streaming", "Shop access", "Priority support"]'::jsonb, 3)
ON CONFLICT (tier) DO NOTHING;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.pending_registrations IS 'Stores users who have completed payment but not yet registered. Used for Pay-to-Register workflow.';
COMMENT ON TABLE public.user_profiles IS 'Extended user profile data linked to Supabase Auth users.';
COMMENT ON TABLE public.subscriptions IS 'Tracks active subscriptions and billing periods for users.';
COMMENT ON TABLE public.payment_history IS 'Complete payment history for audit and analytics.';
COMMENT ON FUNCTION public.check_pending_registration IS 'Checks if an email has a valid pending registration for the registration guard.';
COMMENT ON FUNCTION public.complete_pending_registration IS 'Marks a pending registration as complete and creates the initial subscription.';