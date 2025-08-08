# Cash-Box

**Create professional receipts and maintain accounts for your business in seconds.**

A comprehensive finance management web app built with Next.js 15, TypeScript, Tailwind CSS, and MySQL. Designed for MSME businesses to manage receipts, track transactions, and maintain professional accounting records.

---

## 🚀 Features

- **📊 Dashboard**: Overview of balances, recent transactions, and financial charts
- **🧾 Receipt Management**: Create, edit, and manage professional receipts with GST support
- **💰 Due Management**: Track pending payments and overdue amounts
- **📈 Reports**: Generate comprehensive financial reports with date filtering
- **👤 User Authentication**: Secure signup, login, and profile management
- **📱 Responsive Design**: Mobile-first layout using Tailwind CSS
- **🖼️ File Upload**: Profile photo upload with Supabase storage
- **🔔 Notifications**: Real-time notifications for overdue payments
- **🎨 Modern UI**: Beautiful interface with Radix UI components
- **🔐 Password Recovery**: Forgot password functionality with email reset

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 + TypeScript + React 19
- **Styling**: Tailwind CSS with shadcn/ui components
- **Backend**: Next.js API Routes (Node.js)
- **Database**: MySQL 8.0 (via `mysql2/promise`)
- **Authentication**: JWT with bcrypt password hashing
- **File Storage**: Supabase Storage
- **Package Manager**: pnpm (with npm fallback)
- **Hosting**: Railway (Database + App)
- **Form Handling**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization

---

## 📦 Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/subho2010/Cash-Box.git
   cd Cash-Box
   ```

2. **Install dependencies**
   ```bash
   # Using pnpm (recommended)
   pnpm install
   
   # Or using npm
   npm install
   ```
   
   **Troubleshooting**: If installation fails or shows error try:
   ```bash
   # Force install with pnpm
   pnpm install --force
   
   # Force install with npm
   npm install --force
   
   # Or use legacy peer deps
   pnpm install --legacy-peer-deps
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```ini
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=cash_box
   
   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRES_IN=7d
   
   # Supabase Configuration (for file uploads)
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Initialize the database**
   ```bash
   # Create MySQL database
   mysql -u root -p -e "CREATE DATABASE cash_box;"
   ```
   
   The application will automatically create all necessary tables and procedures on first run.

---

## 🚀 Running Locally

```bash
# Development mode
pnpm dev
# or
npm run dev

# Production build
pnpm build
pnpm start
# or
npm run build
npm start
```

Then, open http://localhost:3000 in your browser.

---

## 🚀 Deployment

### Railway Deployment

1. **Create Railway Account**: Sign up at [railway.app](https://railway.app)

2. **Deploy Database**:
   - Create a new MySQL service
   - Note the connection variables

3. **Deploy Application**:
   - Connect your GitHub repository
   - Set environment variables:
     ```
     DB_HOST=mysql.railway.internal
     DB_NAME=railway
     DB_PASSWORD=[from_mysql_service]
     DB_PORT=3306
     DB_USER=root
     NEXT_PUBLIC_SUPABASE_URL=[your_supabase_url]
     NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_supabase_key]
     JWT_SECRET=[your_jwt_secret]
     JWT_EXPIRES_IN=7d
     ```

4. **Deploy**: Railway will automatically build and deploy your app

---

## 📁 Project Structure

```
Cash-Box/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── due/           # Due management
│   │   ├── forgot-password/ # Password recovery
│   │   ├── login/         # Login endpoint
│   │   ├── notifications/ # Notification system
│   │   ├── profile/       # User profile management
│   │   ├── receipts/      # Receipt CRUD operations
│   │   ├── signup/        # User registration
│   │   ├── transactions/  # Transaction management
│   │   ├── upload/        # File upload handling
│   │   └── viewreceipts/  # Receipt viewing
│   ├── accounts/          # Account management pages
│   ├── create/            # Receipt creation
│   ├── forgot-password/   # Password recovery page
│   ├── login/             # Authentication pages
│   ├── profile/           # User profile pages
│   ├── receipts/          # Receipt management pages
│   ├── report/            # Financial reports
│   ├── signup/            # User registration page
│   └── viewreceipts/      # Receipt viewing pages
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   ├── footer.tsx        # Footer component
│   ├── image-viewer.tsx  # Image viewing component
│   ├── phone-input.tsx   # Phone input component
│   └── theme-provider.tsx # Theme management
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
│   ├── auth.ts           # Authentication utilities
│   ├── database.js       # Database configuration & setup
│   └── utils.ts          # General utilities
├── public/               # Static assets
├── styles/               # Additional styles
├── components.json       # shadcn/ui configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── next.config.mjs       # Next.js configuration
```

---

## 🔧 Key Features Explained

### Receipt Management
- Create professional receipts with customer details
- Support for GST calculations and tax slabs
- Multiple payment types (cash/online)
- Payment status tracking (full/advance/due)
- Receipt numbering and organization

### Due Management
- Track pending payments with due dates
- Automatic overdue notifications
- Payment status updates
- Due amount calculations

### Financial Reports
- Date-range filtered reports
- Transaction summaries
- GST reports for tax compliance
- Export functionality

### User Management
- Secure authentication with JWT
- Profile management with photo upload
- Store information management
- Password recovery system

### Database Features
- Automatic database setup with tables, triggers, and stored procedures
- Connection pooling for optimal performance
- Graceful shutdown handling
- Retry logic for database connections

---

## 🛠️ Development

### Available Scripts
```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### Database Setup
The application automatically creates the database schema on first run, including:
- User management tables
- Receipt and transaction tables
- Due management tables
- Triggers for data consistency
- Stored procedures for complex operations

---

## 👨‍💼 Project Context

This platform was built as part of an internship project in collaboration with:
- **NASSCOM** (National Association of Software and Service Companies)
- **Ministry of Micro, Small & Medium Enterprises (MSME)**, Government of West Bengal

It aims to empower local artisans and small businesses by bringing traditional craftsmanship into the digital economy through modern financial management tools.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Happy financial management! 💰**
