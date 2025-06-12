// lib/database.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { setTimeout } = require('timers/promises');

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cash_box',
  dateStrings: true, // Return dates as strings instead of Date objects
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  connectTimeout: 20000,
  timezone: '+00:00', // UTC
};

// Database state management
let pool = null;
let isInitializing = false;
let initializationPromise = null;
let shutdownSignalReceived = false;

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

/**
 * Initialize database connection pool with retry logic
 */
async function initializePool() {
  if (pool) return pool;
  if (isInitializing) return initializationPromise;

  isInitializing = true;
  initializationPromise = (async () => {
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 1000; // 1 second

    while (attempts < maxAttempts && !shutdownSignalReceived) {
      try {
        attempts++;
        console.log(`Database connection attempt ${attempts}/${maxAttempts}`);

        const newPool = mysql.createPool(dbConfig);
        
        // Test connection
        const conn = await newPool.getConnection();
        
        try {
          // Verify users table exists
          const [tables] = await conn.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
          `, [dbConfig.database]);

          if (tables.length === 0) {
            console.log('Database tables not found. Running setup...');
            const dbSetup = new DatabaseSetup(newPool);
            await dbSetup.setupDatabase();
          }

          console.log('✅ Database connection established and verified');
          pool = newPool;
          return pool;
        } finally {
          conn.release();
        }
      } catch (error) {
        console.error(`Connection attempt ${attempts} failed:`, error.message);
        
        if (error.code === 'ER_BAD_DB_ERROR' && attempts < maxAttempts) {
          // Database doesn't exist, try to create it
          console.log(`Creating database ${dbConfig.database}...`);
          await createDatabase();
          continue;
        }

        if (attempts >= maxAttempts) {
          throw new Error(`Failed to connect after ${maxAttempts} attempts: ${error.message}`);
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempts - 1);
        await setTimeout(delay);
      }
    }
  })().finally(() => {
    isInitializing = false;
  });

  return initializationPromise;
}

/**
 * Create the database if it doesn't exist
 */
async function createDatabase() {
  const tempConfig = {...dbConfig, database: undefined};
  const tempPool = mysql.createPool(tempConfig);
  const tempConn = await tempPool.getConnection();
  
  try {
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` 
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database ${dbConfig.database} created successfully`);
  } finally {
    tempConn.release();
    await tempPool.end();
  }
}

/**
 * Get database connection pool
 */
async function getPool() {
  if (shutdownSignalReceived) {
    throw new Error('Database is shutting down');
  }
  
  if (!pool && !isInitializing) {
    return initializePool();
  }
  
  return pool || initializationPromise;
}

/**
 * Gracefully shutdown database connections
 */
async function gracefulShutdown() {
  if (shutdownSignalReceived) return;
  shutdownSignalReceived = true;

  console.log('Shutting down database connections...');
  
  try {
    if (pool) {
      await pool.end();
      pool = null;
      console.log('Database connections closed');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Execute a database query
 */
async function query(sql, params = [], connection = null) {
  const shouldRelease = !connection;
  let conn = connection;

  try {
    if (!conn) {
      const pool = await getPool();
      conn = await pool.getConnection();
    }

    const [rows] = await conn.query(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', {
      sql,
      params,
      error: error.message
    });
    throw error;
  } finally {
    if (conn && shouldRelease) {
      conn.release();
    }
  }
}

/**
 * Start a transaction
 */
async function beginTransaction() {
  const pool = await getPool();
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  return conn;
}

/**
 * Commit a transaction
 */
async function commitTransaction(connection) {
  try {
    await connection.commit();
  } finally {
    connection.release();
  }
}

/**
 * Rollback a transaction
 */
async function rollbackTransaction(connection) {
  try {
    await connection.rollback();
  } finally {
    connection.release();
  }
}

/**
 * Check if database is connected
 */
async function checkConnection() {
  try {
    const pool = await getPool();
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch (error) {
    return false;
  }
}

class DatabaseSetup {
  constructor(pool) {
    if (!pool) throw new Error('Database pool must be provided');
    this.pool = pool;
  }

  /**
   * Execute a query with optional transaction support
   */
  async executeQuery(query, params = [], conn = null) {
    const shouldRelease = !conn;
    conn = conn || await this.pool.getConnection();
    
    try {
      const [rows] = await conn.query(query, params);
      return rows;
    } catch (error) {
      console.error('Query failed:', {query, error});
      throw error;
    } finally {
      if (shouldRelease && conn) conn.release();
    }
  }

  /**
   * Setup the complete database structure
   */
  async setupDatabase() {
    console.log("Setting up database...");
    const conn = await this.pool.getConnection();

    try {
      // Drop existing triggers to ensure a clean slate before creating them
      await this.executeQuery(`DROP TRIGGER IF EXISTS after_transaction_insert`, [], conn);
      await this.executeQuery(`DROP TRIGGER IF EXISTS after_due_record_change`, [], conn);
      await this.executeQuery(`DROP TRIGGER IF EXISTS after_due_record_update`, [], conn);
      await this.executeQuery(`DROP TRIGGER IF EXISTS update_profile_complete_status`, [], conn);
      await this.executeQuery(`DROP TRIGGER IF EXISTS prevent_superkey_update`, [], conn);
      await this.executeQuery(`DROP TRIGGER IF EXISTS after_receipt_item_insert`, [], conn);
      await this.executeQuery(`DROP TRIGGER IF EXISTS after_receipt_item_update`, [], conn);
      await this.executeQuery(`DROP TRIGGER IF EXISTS after_receipt_item_delete`, [], conn);

      await conn.beginTransaction();
      
      // Switch to our database
      await this.executeQuery(`USE \`${dbConfig.database}\``, [], conn);

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
          gst_number VARCHAR(15),
          profile_complete BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_users_email (email),
          INDEX idx_users_superkey (superkey)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, [], conn);

      // GST Slabs table
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS gst_slabs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          slab_name VARCHAR(50) NOT NULL,
          percentage DECIMAL(5,2) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_slab_per_user (user_id, slab_name),
          INDEX idx_gst_slabs_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, [], conn);

      // Receipts table
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS receipts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          receipt_number VARCHAR(20) NOT NULL UNIQUE,
          date DATE NOT NULL,
          customer_name VARCHAR(100) NOT NULL,
          customer_contact VARCHAR(20) NOT NULL,
          customer_country_code VARCHAR(10) DEFAULT '+91',
          customer_gst_number VARCHAR(15),
          payment_type ENUM('cash', 'online') NOT NULL,
          payment_status ENUM('full', 'advance', 'due') NOT NULL,
          notes TEXT,
          subtotal DECIMAL(10,2) NOT NULL,
          total_tax DECIMAL(10,2) DEFAULT 0,
          total_discount DECIMAL(10,2) DEFAULT 0,
          total DECIMAL(10,2) NOT NULL,
          due_total DECIMAL(10,2) DEFAULT 0,
          user_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_receipts_user_id (user_id),
          INDEX idx_receipts_date (date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, [], conn);

      // Receipt Items
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS receipt_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          receipt_id INT NOT NULL,
          description VARCHAR(255) NOT NULL,
          quantity INT NOT NULL CHECK (quantity > 0),
          price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
          discount DECIMAL(10, 2) DEFAULT 0,
          discount_type ENUM('percentage', 'fixed') DEFAULT 'fixed',
          gst_slab_id INT,
          tax_amount DECIMAL(10, 2) DEFAULT 0,
          advance_amount DECIMAL(10, 2) DEFAULT 0,
          due_amount DECIMAL(10, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE,
          FOREIGN KEY (gst_slab_id) REFERENCES gst_slabs(id) ON DELETE SET NULL,
          INDEX idx_receipt_items_receipt_id (receipt_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, [], conn);

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
      `, [], conn);

      // Due Records
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS due_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_name VARCHAR(100) NOT NULL,
          customer_contact VARCHAR(20) NOT NULL,
          customer_country_code VARCHAR(10) DEFAULT '+91',
          customer_gst_number VARCHAR(15),
          product_ordered TEXT NOT NULL,
          quantity INT NOT NULL CHECK (quantity > 0),
          amount_due DECIMAL(10,2) NOT NULL CHECK (amount_due > 0),
          tax_amount DECIMAL(10,2) DEFAULT 0,
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
      `, [], conn);

      // Account Transactions
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS account_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          particulars TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
          type ENUM('credit', 'debit') NOT NULL,
          tax_amount DECIMAL(10,2) DEFAULT 0,
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
      `, [], conn);

      // Account Balances
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS account_balances (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          balance DECIMAL(10,2) DEFAULT 0,
          total_due_balance DECIMAL(10,2) DEFAULT 0,
          total_tax_collected DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, [], conn);

      // Notifications
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type ENUM('overdue', 'system', 'payment', 'gst') NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          related_id INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_notifications_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, [], conn);

      await conn.commit();
      console.log("✅ Database setup completed successfully");
      // === Triggers & Procedures (must be outside transaction) ===
      await this.createTriggers(conn);
      await this.createProcedures(conn);
      console.log("✅ Triggers and procedures created successfully");
    } catch (error) {
      await conn.rollback();
      console.error("❌ Database setup failed:", error);
      throw error;
    } finally {
      conn.release();
    }
  }

  async createTriggers(conn) {
    console.log("Creating triggers...");

    // Transaction trigger
    await this.executeQuery(`
      CREATE TRIGGER after_transaction_insert
      AFTER INSERT ON account_transactions
      FOR EACH ROW
      BEGIN
        IF (SELECT COUNT(*) FROM account_balances WHERE user_id = NEW.user_id) = 0 THEN
          INSERT INTO account_balances (user_id, balance, total_tax_collected)
          VALUES (NEW.user_id, IF(NEW.type = 'credit', NEW.amount, -NEW.amount), NEW.tax_amount);
        ELSE
          IF NEW.type = 'credit' THEN
            UPDATE account_balances 
            SET balance = balance + NEW.amount,
                total_tax_collected = total_tax_collected + NEW.tax_amount
            WHERE user_id = NEW.user_id;
          ELSE
            UPDATE account_balances 
            SET balance = balance - NEW.amount
            WHERE user_id = NEW.user_id;
          END IF;
        END IF;
      END
    `, [], conn);

    // Due record triggers
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
    `, [], conn);

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
          
          IF NEW.is_paid = TRUE THEN
            INSERT INTO account_transactions (
              particulars, 
              amount, 
              type, 
              tax_amount,
              user_id, 
              due_record_id
            ) VALUES (
              CONCAT('Payment received for due record #', NEW.id),
              NEW.amount_due,
              'credit',
              NEW.tax_amount,
              NEW.user_id,
              NEW.id
            );
          END IF;
        END IF;
      END
    `, [], conn);

    // Profile completion trigger
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
    `, [], conn);

    // Superkey protection trigger
    await this.executeQuery(`
      CREATE TRIGGER prevent_superkey_update
      BEFORE UPDATE ON users
      FOR EACH ROW
      BEGIN
        IF NEW.superkey != OLD.superkey THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Superkey cannot be modified once set';
        END IF;
      END
    `, [], conn);

    // Receipt item triggers for GST calculation
    await this.executeQuery(`
      CREATE TRIGGER after_receipt_item_insert
      AFTER INSERT ON receipt_items
      FOR EACH ROW
      BEGIN
        -- Recalculate totals for the receipt based on all its items, including discounts
        UPDATE receipts
        SET 
          subtotal = (SELECT COALESCE(SUM(
            ri.quantity * ri.price -
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = NEW.receipt_id),
          total_tax = (SELECT COALESCE(SUM(tax_amount), 0) FROM receipt_items WHERE receipt_id = NEW.receipt_id),
          total_discount = (SELECT COALESCE(SUM(
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = NEW.receipt_id),
          total = (SELECT COALESCE(SUM(
            ri.quantity * ri.price -
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END + ri.tax_amount
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = NEW.receipt_id)
        WHERE id = NEW.receipt_id;
      END
    `, [], conn);

    await this.executeQuery(`
      CREATE TRIGGER after_receipt_item_update
      AFTER UPDATE ON receipt_items
      FOR EACH ROW
      BEGIN
        -- Recalculate totals for the receipt based on all its items, including discounts
        UPDATE receipts
        SET 
          subtotal = (SELECT COALESCE(SUM(
            ri.quantity * ri.price -
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = NEW.receipt_id),
          total_tax = (SELECT COALESCE(SUM(tax_amount), 0) FROM receipt_items WHERE receipt_id = NEW.receipt_id),
          total_discount = (SELECT COALESCE(SUM(
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = NEW.receipt_id),
          total = (SELECT COALESCE(SUM(
            ri.quantity * ri.price -
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END + ri.tax_amount
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = NEW.receipt_id)
        WHERE id = NEW.receipt_id;
      END
    `, [], conn);

    await this.executeQuery(`
      CREATE TRIGGER after_receipt_item_delete
      AFTER DELETE ON receipt_items
      FOR EACH ROW
      BEGIN
        -- Recalculate totals for the receipt based on all its remaining items, including discounts
        UPDATE receipts
        SET 
          subtotal = (SELECT COALESCE(SUM(
            ri.quantity * ri.price -
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = OLD.receipt_id),
          total_tax = (SELECT COALESCE(SUM(tax_amount), 0) FROM receipt_items WHERE ri.receipt_id = OLD.receipt_id),
          total_discount = (SELECT COALESCE(SUM(
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = OLD.receipt_id),
          total = (SELECT COALESCE(SUM(
            ri.quantity * ri.price -
            CASE ri.discount_type
              WHEN 'percentage' THEN (ri.quantity * ri.price * ri.discount / 100)
              ELSE ri.discount
            END + ri.tax_amount
          ), 0) FROM receipt_items ri WHERE ri.receipt_id = OLD.receipt_id)
        WHERE id = OLD.receipt_id;
      END
    `, [], conn);

    console.log("✅ All triggers created successfully");
  }

  async createProcedures(conn) {
    console.log("Creating stored procedures...");

    await this.executeQuery(`DROP PROCEDURE IF EXISTS check_profile_complete`, [], conn);
    await this.executeQuery(`DROP PROCEDURE IF EXISTS calculate_gst_report`, [], conn);
    await this.executeQuery(`DROP PROCEDURE IF EXISTS generate_gst_invoice`, [], conn);

    // Profile completion check
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
    `, [], conn);

    // GST report generation
    await this.executeQuery(`
      CREATE PROCEDURE calculate_gst_report(
        IN user_id INT,
        IN from_date DATE,
        IN to_date DATE,
        OUT total_sales DECIMAL(12,2),
        OUT total_tax DECIMAL(12,2),
        OUT taxable_value DECIMAL(12,2)
      )
      BEGIN
        -- Calculate totals for the period
        SELECT 
          COALESCE(SUM(total), 0),
          COALESCE(SUM(total_tax), 0),
          COALESCE(SUM(subtotal), 0)
        INTO 
          total_sales,
          total_tax,
          taxable_value
        FROM receipts
        WHERE 
          user_id = user_id AND
          date BETWEEN from_date AND to_date;
      END
    `, [], conn);

    // GST invoice generation
    await this.executeQuery(`
      CREATE PROCEDURE generate_gst_invoice(IN receipt_id INT)
      BEGIN
        DECLARE user_gst_number VARCHAR(15);
        DECLARE customer_gst_number VARCHAR(15);
        
        -- Get GST numbers
        SELECT u.gst_number, r.customer_gst_number
        INTO user_gst_number, customer_gst_number
        FROM receipts r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = receipt_id;
        
        -- Return invoice data with GST details
        SELECT 
          r.*,
          u.store_name AS seller_name,
          u.store_address AS seller_address,
          u.gst_number AS seller_gst,
          user_gst_number IS NOT NULL AS has_seller_gst,
          customer_gst_number IS NOT NULL AS has_customer_gst,
          (SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'description', ri.description,
              'quantity', ri.quantity,
              'price', ri.price,
              'discount', ri.discount,
              'discount_type', ri.discount_type,
              'tax_amount', ri.tax_amount,
              'gst_slab', IFNULL(gs.slab_name, 'N/A'),
              'gst_rate', IFNULL(gs.percentage, 0),
              'total', (ri.price * ri.quantity) - 
                CASE WHEN ri.discount_type = 'percentage' 
                THEN (ri.price * ri.quantity * ri.discount / 100) 
                ELSE ri.discount END + ri.tax_amount
            )
          ) FROM receipt_items ri
          LEFT JOIN gst_slabs gs ON ri.gst_slab_id = gs.id
          WHERE ri.receipt_id = r.id) AS items
        FROM receipts r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = receipt_id;
      END
    `, [], conn);

    console.log("✅ All stored procedures created successfully");
  }
}

// Initialize database
async function initializeDatabase() {
  try {
    const pool = await getPool();
    const dbSetup = new DatabaseSetup(pool);
    await dbSetup.setupDatabase();
    return pool;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

module.exports = {
  dbConfig,
  getPool,
  initializeDatabase,
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  checkConnection,
  gracefulShutdown,
  DatabaseSetup
};

// Auto-initialize when imported
// NOTE: Do NOT call initializeDatabase or setupDatabase in every API route. Only call ONCE at startup if needed.
if (process.env.DB_AUTO_INIT !== 'false') {
  initializePool().catch(err => {
    console.error('Database auto-init failed:', err.message);
  });
}