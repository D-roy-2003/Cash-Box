const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "money_records",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

class DatabaseSetup {
  constructor() {
    this.pool = pool;
  }

  async executeQuery(query, params = []) {
    const conn = await this.pool.getConnection();
    try {
      const [rows] = await conn.query(query, params);
      return rows;
    } finally {
      conn.release();
    }
  }

  async setupDatabase() {
    const conn = await this.pool.getConnection();
    try {
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.query(`USE \`${dbConfig.database}\``);

      // === Tables ===

      // Users table
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          superkey VARCHAR(5) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          profile_photo VARCHAR(255),
          store_name VARCHAR(100),
          store_address TEXT,
          store_contact VARCHAR(20),
          store_country_code VARCHAR(10) DEFAULT '+91',
          profile_complete BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_users_email (email),
          INDEX idx_users_superkey (superkey)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Receipts table
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS receipts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          receipt_number VARCHAR(20) NOT NULL UNIQUE,
          date DATE NOT NULL,
          customer_name VARCHAR(100) NOT NULL,
          customer_contact VARCHAR(20) NOT NULL,
          customer_country_code VARCHAR(10) DEFAULT '+91',
          payment_type ENUM('cash', 'online') NOT NULL,
          payment_status ENUM('full', 'advance', 'due') NOT NULL,
          notes TEXT,
          total DECIMAL(10,2) NOT NULL,
          due_total DECIMAL(10,2) DEFAULT 0,
          user_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_receipts_user_id (user_id),
          INDEX idx_receipts_date (date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Receipt Items
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS receipt_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          receipt_id INT NOT NULL,
          description VARCHAR(255) NOT NULL,
          quantity INT NOT NULL CHECK (quantity > 0),
          price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
          advance_amount DECIMAL(10, 2) DEFAULT 0,
          due_amount DECIMAL(10, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
          INDEX idx_receipt_items_receipt_id (receipt_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Payment Details
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS payment_details (
          id INT AUTO_INCREMENT PRIMARY KEY,
          receipt_id INT NOT NULL,
          card_number VARCHAR(16),
          phone_number VARCHAR(20),
          phone_country_code VARCHAR(10),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Due Records
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS due_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_name VARCHAR(100) NOT NULL,
          customer_contact VARCHAR(20) NOT NULL,
          customer_country_code VARCHAR(10) DEFAULT '+91',
          product_ordered TEXT NOT NULL,
          quantity INT NOT NULL CHECK (quantity > 0),
          amount_due DECIMAL(10,2) NOT NULL CHECK (amount_due > 0),
          expected_payment_date DATE NOT NULL,
          is_paid BOOLEAN DEFAULT FALSE,
          paid_at TIMESTAMP NULL,
          receipt_number VARCHAR(20),
          user_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_due_records_user_id (user_id),
          INDEX idx_due_records_is_paid (is_paid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Account Transactions
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS account_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          particulars TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
          type ENUM('credit', 'debit') NOT NULL,
          user_id INT NOT NULL,
          receipt_id INT,
          due_record_id INT,
          transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL,
          FOREIGN KEY (due_record_id) REFERENCES due_records(id) ON DELETE SET NULL,
          INDEX idx_transactions_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Account Balances
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS account_balances (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          balance DECIMAL(10,2) DEFAULT 0,
          total_due_balance DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Notifications
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type ENUM('overdue', 'system', 'payment') NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          related_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_notifications_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // === Triggers ===
      await this.createTriggers();

      // === Procedures ===
      await this.createProcedures();

      console.log("✅ Database setup completed successfully");
    } catch (error) {
      console.error("❌ Database setup failed:", error);
      throw error;
    } finally {
      conn.release();
    }
  }

  async createTriggers() {
    console.log("Creating triggers...");

    await this.executeQuery(`DROP TRIGGER IF EXISTS after_transaction_insert`);
    await this.executeQuery(`DROP TRIGGER IF EXISTS after_due_record_change`);
    await this.executeQuery(`DROP TRIGGER IF EXISTS after_due_record_update`);
    await this.executeQuery(`DROP TRIGGER IF EXISTS update_profile_complete_status`);
    await this.executeQuery(`DROP TRIGGER IF EXISTS prevent_superkey_update`);

    await this.executeQuery(`
      CREATE TRIGGER after_transaction_insert
      AFTER INSERT ON account_transactions
      FOR EACH ROW
      BEGIN
        IF (SELECT COUNT(*) FROM account_balances WHERE user_id = NEW.user_id) = 0 THEN
          INSERT INTO account_balances (user_id, balance)
          VALUES (NEW.user_id, IF(NEW.type = 'credit', NEW.amount, -NEW.amount));
        ELSE
          IF NEW.type = 'credit' THEN
            UPDATE account_balances SET balance = balance + NEW.amount WHERE user_id = NEW.user_id;
          ELSE
            UPDATE account_balances SET balance = balance - NEW.amount WHERE user_id = NEW.user_id;
          END IF;
        END IF;
      END
    `);

    await this.executeQuery(`
      CREATE TRIGGER after_due_record_change
      AFTER INSERT ON due_records
      FOR EACH ROW
      BEGIN
        IF (SELECT COUNT(*) FROM account_balances WHERE user_id = NEW.user_id) = 0 THEN
          INSERT INTO account_balances (user_id, total_due_balance)
          VALUES (NEW.user_id, NEW.amount_due);
        ELSE
          UPDATE account_balances 
          SET total_due_balance = (
            SELECT COALESCE(SUM(amount_due), 0) 
            FROM due_records 
            WHERE user_id = NEW.user_id AND is_paid = FALSE
          )
          WHERE user_id = NEW.user_id;
        END IF;
      END
    `);

    await this.executeQuery(`
      CREATE TRIGGER after_due_record_update
      AFTER UPDATE ON due_records
      FOR EACH ROW
      BEGIN
        IF NEW.is_paid != OLD.is_paid THEN
          UPDATE account_balances 
          SET total_due_balance = (
            SELECT COALESCE(SUM(amount_due), 0)
            FROM due_records 
            WHERE user_id = NEW.user_id AND is_paid = FALSE
          )
          WHERE user_id = NEW.user_id;
        END IF;
      END
    `);

    await this.executeQuery(`
      CREATE TRIGGER update_profile_complete_status
      BEFORE UPDATE ON users
      FOR EACH ROW
      BEGIN
        DECLARE is_complete BOOLEAN;
        SET is_complete = (
          NEW.name IS NOT NULL AND NEW.name != '' AND
          NEW.store_name IS NOT NULL AND NEW.store_name != '' AND
          NEW.store_address IS NOT NULL AND NEW.store_address != '' AND
          NEW.store_contact IS NOT NULL AND NEW.store_contact REGEXP '^[0-9]{10}$'
        );
        SET NEW.profile_complete = is_complete;
      END
    `);

    await this.executeQuery(`
      CREATE TRIGGER prevent_superkey_update
      BEFORE UPDATE ON users
      FOR EACH ROW
      BEGIN
        IF NEW.superkey != OLD.superkey THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Superkey cannot be modified once set';
        END IF;
      END
    `);

    console.log("✅ All triggers created successfully");
  }

  async createProcedures() {
    console.log("Creating stored procedures...");

    await this.executeQuery(`DROP PROCEDURE IF EXISTS check_profile_complete`);
    await this.executeQuery(`
      CREATE PROCEDURE check_profile_complete(IN user_id INT, OUT is_complete BOOLEAN)
      BEGIN
        SELECT 
          (name IS NOT NULL AND name != '' AND
           store_name IS NOT NULL AND store_name != '' AND
           store_address IS NOT NULL AND store_address != '' AND
           store_contact IS NOT NULL AND store_contact REGEXP '^[0-9]{10}$')
        INTO is_complete
        FROM users
        WHERE id = user_id;
      END
    `);

    console.log("✅ All stored procedures created successfully");
  }
}

// Initialize database
async function initializeDatabase() {
  const dbSetup = new DatabaseSetup();
  await dbSetup.setupDatabase();
}

module.exports = {
  pool,
  DatabaseSetup,
  initializeDatabase,
  dbConfig
};

// Run setup if executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
