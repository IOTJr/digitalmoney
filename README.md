# Trixie Subscription Platform

A high-performance subscription platform with a "Pay-to-Register" workflow using Next.js 15, Supabase, Dodo Payments, and M-Pesa Daraja STK Push.

## Features

- **Pay-to-Register Flow**: Users must complete payment before they can create an account
- **Subscription Tiers**: Three tiers ($15, $30, $50/month) with different access levels
- **Secure Checkout Page**: Users are redirected to `/checkout` to choose card or M-Pesa payment
- **M-Pesa STK Push**: Daraja API integration for PIN approval on customer phones
- **USD to KES Conversion**: Server-side currency conversion for M-Pesa charges in Kenyan Shillings
- **Session Guards**: Automatic subscription verification on every page load
- **Secure Storage**: Supabase Storage with signed URLs for media files
- **Community Features**: Real-time chat, announcements, and shop area (coming soon)

## Tech Stack

- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Shadcn UI
- **Backend/Database**: Supabase (PostgreSQL, Auth, Storage)
- **Payments**: Dodo Payments API + M-Pesa Daraja API
- **State Management**: React Query

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Dodo Payments merchant account

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```env
# Dodo Payments
DODO_PAYMENTS_API_KEY=your_api_key
DODO_PAYMENTS_WEBHOOK_SECRET=your_webhook_secret

# M-Pesa Daraja
MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=your_daraja_consumer_key
MPESA_CONSUMER_SECRET=your_daraja_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_lipa_na_mpesa_passkey
MPESA_CALLBACK_TOKEN=long_random_callback_token
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline

# Optional fallback FX rate (used when live rate API is unavailable)
STATIC_USD_TO_KES_RATE=130

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

1. Run the SQL migration in your Supabase project:
   - Go to Supabase Dashboard > SQL Editor
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Execute the migration

2. Get your Supabase Service Role Key from:
   - Project Settings > API > Service Role Key

### Dodo Payments Webhook Setup

Configure your Dodo Payments webhook to point to:
```
https://your-domain.com/api/webhooks/dodo
```

The webhook should send events with the `x-dodo-signature` header for signature verification.

### M-Pesa Daraja Callback Setup

Set your Daraja callback URL to:
```
https://your-domain.com/api/webhooks/mpesa?token=your_mpesa_callback_token
```

Use the same value for `your_mpesa_callback_token` as `MPESA_CALLBACK_TOKEN`.

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── api/
│   │   └── webhooks/dodo/  # Dodo webhook handler
│   ├── register/           # Registration page with payment guard
│   ├── pricing/            # Pricing page
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # Shadcn UI components
│   ├── pricing/            # Pricing cards component
│   └── register/           # Registration form
├── lib/
│   ├── supabase/           # Supabase client utilities
│   ├── dodo/               # Dodo Payments API client
│   └── actions/            # Server actions
├── supabase/
│   └── migrations/         # Database migrations
└── middleware.ts           # Auth & subscription guards
```

## Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| Basic | $15/mo | Access to basic content, Community discussion, Announcements |
| Expanded | $30/mo | Everything in Basic + File downloads (PDF, ZIP), Extended content library |
| Exclusive | $50/mo | Everything in Expanded + Video streaming, Shop access, Priority support |

## Pay-to-Register Flow

1. User visits `/pricing` and selects a tier
2. User enters email and is redirected to `/checkout`
3. User chooses payment method:
   - Card: server creates a Dodo checkout session and redirects
   - M-Pesa: server initiates Daraja STK Push in KES
4. Payment provider webhook/callback records successful payment
5. Pending registration is created in the database
6. User opens `/register` with the paid email and creates account
7. Subscription is activated after registration

## Security

- Webhook signatures are verified using HMAC-SHA256
- M-Pesa callback route requires a shared callback token
- M-Pesa and Dodo secrets are kept server-side only
- RLS policies protect all database tables
- Service role key is only used server-side
- Signed URLs for media storage prevent unauthorized access

## License

MIT