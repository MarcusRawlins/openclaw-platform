# ZipGolf (Birdieway)

Multi-tenant golf SaaS platform for digital passes, gift cards, and lesson bookings.

## Features

- **Multi-Tenant Architecture**: Each golf course is an independent tenant
- **Digital Passes**: Punch cards, unlimited passes, monthly/annual memberships
- **Gift Cards**: Digital gift cards with redemption tracking
- **Lesson Bookings**: Schedule and manage golf lessons
- **Stripe Connect**: Payment processing with platform fees

## Tech Stack

- Next.js 16
- Bun (runtime)
- PostgreSQL + Prisma 7
- Stripe Connect (payments)
- TypeScript
- Tailwind CSS

## Database Schema

See `prisma/schema.prisma` for full data model including:
- Course (multi-tenant)
- User (customers, instructors, staff, admins)
- Pass (digital punch cards, memberships)
- GiftCard (digital gift cards)
- Lesson (offerings)
- Booking (lesson reservations)
- Purchase (pass/gift card purchases)
- Transaction (payment records)

## Getting Started

### Prerequisites

- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- PostgreSQL database
- Stripe account (for payments)

### Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and Stripe keys
   ```

3. Run database migrations:
   ```bash
   bunx prisma migrate dev --name init
   bunx prisma generate
   ```

4. Start development server:
   ```bash
   bun run dev
   ```

5. Open [http://localhost:3300](http://localhost:3300)

## Multi-Tenant Model

Each golf course registers as a tenant with:
- Unique slug (subdomain or /courses/[slug])
- Stripe Connect account (for payments)
- Custom branding (logo, colors)
- Feature toggles (passes, gift cards, lessons)

## Payment Flow

1. Customer purchases pass/gift card/lesson
2. Stripe payment processed
3. Platform fee deducted (e.g., 10%)
4. Remaining amount transferred to course's Stripe Connect account
5. Transaction recorded in database

## Status

**Phase 1 MVP**: Foundation complete
- ✅ Database schema designed
- ✅ Multi-tenant model defined
- ⏳ API routes (in progress)
- ⏳ Frontend UI (in progress)
- ⏳ Stripe integration (in progress)
- ⏳ Authentication (in progress)

## Development Roadmap

**Phase 1**: Core Features
- [ ] Course registration & onboarding
- [ ] Stripe Connect integration
- [ ] Pass purchase & management
- [ ] Gift card purchase & redemption
- [ ] Lesson booking system
- [ ] Customer dashboard
- [ ] Course admin dashboard

**Phase 2**: Enhanced Features
- [ ] Mobile app (React Native)
- [ ] QR code check-in
- [ ] Waitlist management
- [ ] Email notifications
- [ ] Analytics dashboard
- [ ] Multi-location support

**Phase 3**: Advanced Features
- [ ] Tee time booking
- [ ] Tournament management
- [ ] Loyalty rewards program
- [ ] API for third-party integrations

## License

Proprietary
