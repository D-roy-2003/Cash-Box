const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Debug: Verify environment variables are loaded
console.log("[DEBUG] Environment Variables:", {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME,
});

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
  connectTimeout: 10000, // 10 seconds timeout
};

// Export application pool
export const pool = mysql.createPool(dbConfig);

class DatabaseSetup {
  constructor() {
    this.pool = null;
    this.connection = null;
  }

  // Test MySQL server connection
  async testConnection() {
    console.log("[DEBUG] Testing MySQL server connection...");
    let conn;
    try {
      conn = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        connectTimeout: 5000,
      });
      console.log("✅ Successfully connected to MySQL server");
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to MySQL server:", error.message);
      console.error("Full error:", error);
      return false;
    } finally {
      if (conn) await conn.end();
    }
  }

  // Execute query with error handling
  async executeQuery(query, params) {
    if (!this.connection) throw new Error("No database connection");

    try {
      console.log(`[DEBUG] Executing query: ${query.substring(0, 50)}...`);
      const [rows] = await this.connection.query(query, params);
      return rows;
    } catch (error) {
      console.error(
        `❌ Query failed: ${query.substring(0, 50)}...`,
        error.message
      );
      throw error;
    }
  }

  // Connect to MySQL server
  async connect() {
    console.log("[DEBUG] Establishing database connection...");
    try {
      this.pool = mysql.createPool({
        ...dbConfig,
        database: undefined, // Connect without specific DB first
      });
      this.connection = await this.pool.getConnection();
      console.log("✅ Database connection established");
    } catch (error) {
      console.error("❌ Connection failed:", error.message);
      throw error;
    }
  }

  // Check if database exists
  async databaseExists() {
    console.log("[DEBUG] Checking if database exists...");
    const result = await this.executeQuery(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [dbConfig.database]
    );
    return result.length > 0;
  }

  // Create the database
  async createDatabase() {
    console.log(`[DEBUG] Creating database ${dbConfig.database}...`);
    await this.executeQuery(
      `CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`
    );
    console.log(`✅ Database '${dbConfig.database}' ready`);
  }

  // Use the target database
  async useDatabase() {
    console.log("[DEBUG] Switching to target database...");
    await this.executeQuery(`USE ${dbConfig.database}`);
  }
  // Create all tables
  async createTables() {
    console.log("Creating tables...");

    // Users Table
    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        profile_photo LONGTEXT,
        store_name VARCHAR(100),
        store_address TEXT,
        store_contact VARCHAR(20),
        store_country_code VARCHAR(10) DEFAULT '+91',
        email_verified BOOLEAN DEFAULT FALSE,
        phone_verified BOOLEAN DEFAULT FALSE,
        profile_complete BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email)
      );
    `);

    // Receipts Table
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
        total DECIMAL(10, 2) NOT NULL,
        due_total DECIMAL(10, 2) DEFAULT 0,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_receipts_user_id (user_id),
        INDEX idx_receipts_date (date)
      );
    `);

    // Receipt Items Table
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
      );
    `);

    // Payment Details Table
    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS payment_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_id INT NOT NULL,
        card_number VARCHAR(16),
        phone_number VARCHAR(20),
        phone_country_code VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
      );
    `);

    // Due Records Table
    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS due_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(100) NOT NULL,
        customer_contact VARCHAR(20) NOT NULL,
        customer_country_code VARCHAR(10) DEFAULT '+91',
        product_ordered TEXT NOT NULL,
        quantity INT NOT NULL CHECK (quantity > 0),
        amount_due DECIMAL(10, 2) NOT NULL CHECK (amount_due > 0),
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
      );
    `);

    // Account Transactions Table
    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS account_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        particulars TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
        type ENUM('credit', 'debit') NOT NULL,
        user_id INT NOT NULL,
        receipt_id INT,
        due_record_id INT,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL,
        FOREIGN KEY (due_record_id) REFERENCES due_records(id) ON DELETE SET NULL,
        INDEX idx_transactions_user_id (user_id)
      );
    `);

    // Account Balances Table
    await this.executeQuery(`
      CREATE TABLE IF NOT EXISTS account_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        balance DECIMAL(10, 2) DEFAULT 0,
        total_due_balance DECIMAL(10, 2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Notifications Table
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
      );
    `);
  }

  // Create all triggers
  async createTriggers() {
    console.log("Creating triggers...");

    // Drop triggers if they exist
    await this.executeQuery(`DROP TRIGGER IF EXISTS after_transaction_insert`);
    await this.executeQuery(`DROP TRIGGER IF EXISTS after_due_record_change`);
    await this.executeQuery(`DROP TRIGGER IF EXISTS after_due_record_update`);

    // Transaction trigger
    await this.executeQuery(`
      CREATE TRIGGER after_transaction_insert
      AFTER INSERT ON account_transactions
      FOR EACH ROW
      BEGIN
        IF NEW.type = 'credit' THEN
          UPDATE account_balances 
          SET balance = balance + NEW.amount 
          WHERE user_id = NEW.user_id;
        ELSE
          UPDATE account_balances 
          SET balance = balance - NEW.amount 
          WHERE user_id = NEW.user_id;
        END IF;
        
        IF (SELECT COUNT(*) FROM account_balances WHERE user_id = NEW.user_id) = 0 THEN
          INSERT INTO account_balances (user_id, balance) 
          VALUES (NEW.user_id, IF(NEW.type = 'credit', NEW.amount, -NEW.amount));
        END IF;
      END;
    `);

    // Due record triggers
    await this.executeQuery(`
      CREATE TRIGGER after_due_record_change
      AFTER INSERT ON due_records
      FOR EACH ROW
      BEGIN
        UPDATE account_balances 
        SET total_due_balance = (
          SELECT SUM(amount_due) 
          FROM due_records 
          WHERE user_id = NEW.user_id AND is_paid = FALSE
        )
        WHERE user_id = NEW.user_id;
        
        IF (SELECT COUNT(*) FROM account_balances WHERE user_id = NEW.user_id) = 0 THEN
          INSERT INTO account_balances (user_id, total_due_balance) 
          VALUES (NEW.user_id, NEW.amount_due);
        END IF;
      END;
    `);

    await this.executeQuery(`
      CREATE TRIGGER after_due_record_update
      AFTER UPDATE ON due_records
      FOR EACH ROW
      BEGIN
        IF NEW.is_paid != OLD.is_paid THEN
          UPDATE account_balances 
          SET total_due_balance = (
            SELECT SUM(amount_due) 
            FROM due_records 
            WHERE user_id = NEW.user_id AND is_paid = FALSE
          )
          WHERE user_id = NEW.user_id;
        END IF;
      END;
    `);
  }

  // Main setup method
  async setup() {
    try {
      console.log("\n=== Starting Database Setup ===");

      // Verify connection first
      if (!(await this.testConnection())) {
        throw new Error("Cannot connect to MySQL server");
      }

      // Connect to server
      await this.connect();

      // Create database if needed
      if (!(await this.databaseExists())) {
        await this.createDatabase();
      }

      // Use the database
      await this.useDatabase();

      // Create tables
      await this.createTables();

      // Create triggers
      await this.createTriggers();

      console.log("\n✅ Database setup completed successfully!");
      return true;
    } catch (error) {
      console.error("\n❌ Database setup failed:", error.message);
      console.error("Stack trace:", error.stack);
      throw error;
    } finally {
      // Cleanup
      if (this.connection) {
        console.log("[DEBUG] Releasing database connection...");
        await this.connection.release();
      }
      if (this.pool) {
        console.log("[DEBUG] Closing connection pool...");
        await this.pool.end();
      }
    }
  }
}

// Export initialization function
export async function initializeDatabase() {
  try {
    console.log("🚀 Initializing database setup...");
    const dbSetup = new DatabaseSetup();
    await dbSetup.setup();
    console.log("✨ Database setup completed!");
  } catch (error) {
    console.error("💥 Critical error during setup:", error);
    throw error;
  }
}
