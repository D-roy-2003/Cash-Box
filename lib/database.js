import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

export const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export let pool;

export const connectToDatabase = async () => {
  try {
    if (!pool) {
      // Create database if not exists
      const tempConnection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });

      await tempConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` 
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await tempConnection.end();

      // Create connection pool
      pool = mysql.createPool(dbConfig);

      // Create tables
      const connection = await pool.getConnection();
      await createTables(connection);
      connection.release();
      console.log("Database initialized successfully");
    }
    return pool;
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
};

async function createTables(connection) {
  // Users table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      store_name VARCHAR(255),
      store_address VARCHAR(255),
      store_contact VARCHAR(20),
      store_country_code VARCHAR(10),
      profile_photo VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Account Balances
  await connection.query(`
    CREATE TABLE IF NOT EXISTS account_balances (
      user_id INT PRIMARY KEY,
      balance DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_due_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Receipts
  await connection.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_number VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_contact VARCHAR(20) NOT NULL,
      customer_country_code VARCHAR(10) NOT NULL,
      payment_type ENUM('cash', 'card', 'mobile') NOT NULL,
      payment_status ENUM('full', 'partial', 'due') NOT NULL,
      notes TEXT,
      total DECIMAL(10,2) NOT NULL,
      due_total DECIMAL(10,2) NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Receipt Items
  await connection.query(`
    CREATE TABLE IF NOT EXISTS receipt_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_id INT NOT NULL,
      description VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      advance_amount DECIMAL(10,2) DEFAULT 0,
      due_amount DECIMAL(10,2) DEFAULT 0,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Payment Details
  await connection.query(`
    CREATE TABLE IF NOT EXISTS payment_details (
      receipt_id INT PRIMARY KEY,
      card_number VARCHAR(255),
      phone_number VARCHAR(20),
      phone_country_code VARCHAR(10),
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Due Records
  await connection.query(`
    CREATE TABLE IF NOT EXISTS due_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(255) NOT NULL,
      customer_contact VARCHAR(20) NOT NULL,
      customer_country_code VARCHAR(10) NOT NULL,
      product_ordered TEXT NOT NULL,
      quantity INT NOT NULL,
      amount_due DECIMAL(10,2) NOT NULL,
      expected_payment_date DATE NOT NULL,
      is_paid BOOLEAN NOT NULL DEFAULT FALSE,
      paid_at DATETIME,
      user_id INT NOT NULL,
      receipt_number VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Account Transactions
  await connection.query(`
    CREATE TABLE IF NOT EXISTS account_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      particulars VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      type ENUM('credit', 'debit') NOT NULL,
      user_id INT NOT NULL,
      receipt_id INT,
      due_record_id INT,
      transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL,
      FOREIGN KEY (due_record_id) REFERENCES due_records(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await addDefaultData(connection);
}

async function addDefaultData(connection) {
  // Add demo user
  const [users] = await connection.query("SELECT COUNT(*) as count FROM users");
  if (users[0].count === 0) {
    const hashedPass = await bcrypt.hash("demo123", 10);
    await connection.query(
      `
      INSERT INTO users (name, email, password, store_name)
      VALUES ('Demo User', 'demo@example.com', ?, 'Demo Store')
    `,
      [hashedPass]
    );
    console.log("Demo user created");
  }

  // Initialize account balance
  const [balances] = await connection.query(
    "SELECT COUNT(*) as count FROM account_balances"
  );
  if (balances[0].count === 0) {
    await connection.query(`
      INSERT INTO account_balances (user_id, balance, total_due_balance)
      VALUES (1, 0, 0)
    `);
  }
}
