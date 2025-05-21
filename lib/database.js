import mysql from "mysql2/promise";
import dotenv from "dotenv";
// Load environment variables
dotenv.config();

// Database connection configuration (using environment variables)
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "money_records_app",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "money_records",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Helper function to execute SQL queries with error handling
async function executeQuery(
  connection: mysql.PoolConnection,
  query: string,
  params?: any[]
) {
  try {
    const [rows] = await connection.query(query, params);
    return rows;
  } catch (error) {
    console.error(`Error executing query: ${query}`, error);
    throw error;
  }
}

async function createDatabase() {
  let connection: mysql.PoolConnection | null = null;
  let pool: mysql.Pool | null = null;

  try {
    // Create a connection pool (better for production)
    pool = mysql.createPool({
      ...dbConfig,
      database: undefined, // Connect without specifying DB first
    });

    connection = await pool.getConnection();

    // Check if database exists
    console.log("Checking if database exists...");
    const [existingDbs] = await executeQuery(
      connection,
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [dbConfig.database]
    );

    if (existingDbs.length === 0) {
      console.log("Creating database...");
      await executeQuery(connection, `CREATE DATABASE ${dbConfig.database}`);
    }

    // Switch to the new database
    await executeQuery(connection, `USE ${dbConfig.database}`);

    // ====== TABLE CREATION ======
    console.log("Creating tables...");

    // Users Table
    await executeQuery(
      connection,
      `
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
    `
    );

    // Receipts Table
    await executeQuery(
      connection,
      `
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
    `
    );

    // Receipt Items Table
    await executeQuery(
      connection,
      `
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
    `
    );

    // Payment Details Table
    await executeQuery(
      connection,
      `
      CREATE TABLE IF NOT EXISTS payment_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_id INT NOT NULL,
        card_number VARCHAR(16),
        phone_number VARCHAR(20),
        phone_country_code VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
      );
    `
    );

    // Due Records Table
    await executeQuery(
      connection,
      `
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
    `
    );

    // Account Transactions Table
    await executeQuery(
      connection,
      `
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
    `
    );

    // Account Balances Table
    await executeQuery(
      connection,
      `
      CREATE TABLE IF NOT EXISTS account_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        balance DECIMAL(10, 2) DEFAULT 0,
        total_due_balance DECIMAL(10, 2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `
    );

    // Notifications Table
    await executeQuery(
      connection,
      `
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
    `
    );

    // ====== TRIGGERS ======
    console.log("Creating triggers...");

    // Trigger to update account balance on transaction insert
    await executeQuery(
      connection,
      `
      CREATE TRIGGER IF NOT EXISTS after_transaction_insert
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
    `
    );

    // Trigger to update due balance when a due record changes
    await executeQuery(
      connection,
      `
      CREATE TRIGGER IF NOT EXISTS after_due_record_change
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
    `
    );

    // Trigger to update due balance when a due record is updated
    await executeQuery(
      connection,
      `
      CREATE TRIGGER IF NOT EXISTS after_due_record_update
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
    `
    );

    console.log("✅ Database setup completed successfully!");
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    process.exit(1);
  } finally {
    if (connection) await connection.release();
    if (pool) await pool.end();
  }
}

// Run the setup
createDatabase();
