# Cash-Box

**Create professional receipts and maintain accounts for your business in seconds.**

A simple, performant finance management web app built with Next.js, TypeScript, Tailwind CSS, and MySQL.

---

## 🚀 Features

- **Dashboard**: Overview of balances, recent transactions, and charts
- **Transactions**: Create, edit, and delete income or expense entries
- **Reports**: Generate date-filtered reports (daily, monthly, custom)
- **User Authentication**: Secure signup, login, and session management
- **Responsive Design**: Mobile-first layout using Tailwind CSS

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 + TypeScript
- **Styling**: Tailwind CSS (JIT mode) with Purge
- **Backend**: Next.js API Routes (Node.js)
- **Database**: MySQL 8.0 (via `mysql2/promise`)
- **ORM**: (Optional) Prisma or custom query functions
- **Hosting**: Vercel / DigitalOcean / Local Docker

---

## 📦 Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/subho2010/Cash-Box.git
   cd cash-box
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Set up environment variables**
   Copy `.env.example` to `.env` and provide:
   ```ini
   DB_PORT=3306
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=cash_box_db
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=7d
   DATABASE_URL=mysql://[DB_USER]:[DB_PASSWORD]@localhost:3306/[DB_NAME]
   ```
4. **Initialize the database**
   ```bash
   # Create MySQL database
   mysql -u root -p -e "CREATE DATABASE cash_box_db;"
   ```

---

## 🚀 Running Locally

```bash
# Development mode
npm run dev
# Production build
npm run build
npm start
```

Then, open http://localhost:3000 in your browser.

## 👨‍💼 Project Context
This platform was built as part of an internship project in collaboration with:

-NASSCOM (National Association of Software and Service Companies)
-Ministry of Micro, Small & Medium Enterprises(MSME), Government of West Bengal

_Happy budgeting!_
