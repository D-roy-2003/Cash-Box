import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

let connection;

export const connectToDatabase = async () => {
  try {
    if (!connection) {
      // Connect without database first
      const tempConnection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });

      // Create database if not exists
      await tempConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` 
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await tempConnection.end();

      // Connect to the database
      connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: "utf8mb4",
      });

      // Create tables
      await createTables();
      console.log("Database initialized successfully");
    }
    return connection;
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
};

async function createTables() {
  // Updated users table with username
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      artisanId VARCHAR(50) UNIQUE,
      PhoneNumber VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      specialization VARCHAR(255) DEFAULT NULL,
      profileImage VARCHAR(255) DEFAULT NULL,
      listed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_artisanId (artisanId),
      INDEX idx_listed (listed)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Products table (unchanged)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      artisanId VARCHAR(50) NOT NULL,
      productName VARCHAR(255) NOT NULL,
      productPrice DECIMAL(10,2),
      material VARCHAR(255),
      height VARCHAR(50),
      width VARCHAR(50),
      weight VARCHAR(50),
      certification VARCHAR(255) DEFAULT NULL,
      finish VARCHAR(255) DEFAULT NULL,
      closureType VARCHAR(255) DEFAULT NULL,
      image1 VARCHAR(255),
      image2 VARCHAR(255),
      image3 VARCHAR(255),
      image4 VARCHAR(255),
      image5 VARCHAR(255),
      productDescription TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_listed BOOLEAN NOT NULL DEFAULT FALSE,
      listed_at DATETIME DEFAULT NULL,
      FOREIGN KEY (artisanId) REFERENCES users(artisanId) ON DELETE CASCADE,
      INDEX idx_artisanId (artisanId),
      INDEX idx_is_listed (is_listed),
      FULLTEXT INDEX ft_product_search (productName, productDescription, material)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Feedback table (unchanged)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_read BOOLEAN DEFAULT FALSE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // ADMIN table (unchanged)
  await connection.query(`
  CREATE TABLE IF NOT EXISTS admindata (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) DEFAULT NULL,
    adminId VARCHAR(50) NOT NULL UNIQUE,
    adminPassword VARCHAR(255) NOT NULL,
    adminPassKey VARCHAR(255) NOT NULL,
    phonenumber VARCHAR(20) DEFAULT NULL,
    email VARCHAR(255) DEFAULT NULL,
    address VARCHAR(255) DEFAULT NULL,
    profileimage VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

  // Add default data if tables are empty
  await addDefaultData();
}

async function addDefaultData() {
  // Add default admin
  const [admins] = await connection.query('SELECT COUNT(*) as count FROM admindata');
  if (admins[0].count === 0) {
    const hashedPassword = await bcrypt.hash('admin2003', 10); // <-- Correct password
    await connection.query(`
      INSERT INTO admindata (adminId, adminPassword, adminPassKey)
      VALUES ('admin123', ?, ?) 
    `, [hashedPassword , process.env.ADMIN_PASS_KEY || 'ADMIN123']);// Use environment variable
    console.log('Default admin created');
  }

  // Add demo artisan for sample products
  const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
  if (users[0].count === 0) {
    const hashedArtisanPass = await bcrypt.hash('demo123', 10);
    await connection.query(`
      INSERT INTO users (username, artisanId, PhoneNumber, password, listed)
      VALUES ('Demo Artisan', 'DEMO001', '0000000000', ?, TRUE)
    `, [hashedArtisanPass]);
    console.log('Demo artisan created for sample products');
  }

  // Add sample products with valid artisan reference
  const [products] = await connection.query('SELECT COUNT(*) as count FROM products');
  if (products[0].count === 0) {
    await connection.query(`
      INSERT INTO products (artisanId, productName, productPrice, productDescription, is_listed)
      VALUES 
        ('DEMO001', 'Handcrafted Vase', 49.99, 'Beautiful ceramic vase with traditional patterns', TRUE),
        ('DEMO001', 'Artisan Necklace', 89.99, 'Silver necklace with hand-carved pendant', TRUE)
    `);
    console.log('Sample products created for featured slider');
  }
}

// Handle connection errors
process.on("unhandledRejection", (err) => {
  if (err.code === "PROTOCOL_CONNECTION_LOST") {
    console.error("Database connection was closed. Reconnecting...");
    connection = null;
  } else {
    console.error("Unhandled database error:", err);
  }
});
