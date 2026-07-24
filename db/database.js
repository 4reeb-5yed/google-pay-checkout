const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'store.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize schema
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

// Seed catalog products if empty
const countStmt = db.prepare('SELECT COUNT(*) AS count FROM products');
const row = countStmt.get();

if (row.count === 0) {
  const seedProducts = [
    // Devices
    {
      id: 'smart-hub',
      name: 'Smart Hub',
      category: 'Devices',
      price_cents: 14999,
      description: 'Central control hub for connected IoT gear and dev accessories.',
      image: '/assets/smart-hub.jpg',
      type: 'physical',
      recurrence_period: null,
      recurrence_period_count: null
    },
    {
      id: 'wireless-mic',
      name: 'Wireless Mic Kit',
      category: 'Devices',
      price_cents: 8999,
      description: 'Broadcast-grade wireless dual microphone system for creators.',
      image: '/assets/wireless-mic.jpg',
      type: 'physical',
      recurrence_period: null,
      recurrence_period_count: null
    },
    {
      id: 'ai-dev-cam',
      name: 'AI Dev Camera',
      category: 'Devices',
      price_cents: 19999,
      description: '4K edge AI camera with spatial object tracking.',
      image: '/assets/ai-dev-cam.jpg',
      type: 'physical',
      recurrence_period: null,
      recurrence_period_count: null
    },

    // Accessories
    {
      id: 'charging-dock',
      name: 'Charging Dock',
      category: 'Accessories',
      price_cents: 2999,
      description: 'Fast magnetic multi-device charging stand.',
      image: '/assets/charging-dock.jpg',
      type: 'physical',
      recurrence_period: null,
      recurrence_period_count: null
    },
    {
      id: 'carry-case',
      name: 'Carry Case',
      category: 'Accessories',
      price_cents: 1999,
      description: 'Weatherproof padded protective case for creator hardware.',
      image: '/assets/carry-case.jpg',
      type: 'physical',
      recurrence_period: null,
      recurrence_period_count: null
    },
    {
      id: 'usbc-cable-set',
      name: 'USB-C Cable Set',
      category: 'Accessories',
      price_cents: 1499,
      description: 'Braided high-speed 240W USB-C data & power cables (3-pack).',
      image: '/assets/usbc-cable-set.jpg',
      type: 'physical',
      recurrence_period: null,
      recurrence_period_count: null
    },
    {
      id: 'desk-mount',
      name: 'Desk Mount',
      category: 'Accessories',
      price_cents: 3499,
      description: 'Heavy-duty articulated desk mount clamp for mics and cameras.',
      image: '/assets/desk-mount.jpg',
      type: 'physical',
      recurrence_period: null,
      recurrence_period_count: null
    },

    // Plans (Subscriptions)
    {
      id: 'pro-monthly',
      name: 'Pro Monthly Plan',
      category: 'Plans',
      price_cents: 1499,
      description: 'Unlimited cloud storage, AI edge analytics, and premium support (billed monthly).',
      image: '/assets/pro-plan.jpg',
      type: 'subscription',
      recurrence_period: 'MONTH',
      recurrence_period_count: 1
    },
    {
      id: 'pro-annual',
      name: 'Pro Annual Plan',
      category: 'Plans',
      price_cents: 14999,
      description: 'Unlimited cloud storage, AI edge analytics, and premium support (billed annually — 2 months free).',
      image: '/assets/pro-plan.jpg',
      type: 'subscription',
      recurrence_period: 'YEAR',
      recurrence_period_count: 1
    },
    {
      id: 'starter-plan',
      name: 'Starter Plan',
      category: 'Plans',
      price_cents: 0,
      description: 'Basic cloud connectivity and standard telemetry.',
      image: '/assets/starter-plan.jpg',
      type: 'subscription',
      recurrence_period: 'MONTH',
      recurrence_period_count: 1
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO products (
      id, name, category, price_cents, description, image, type, recurrence_period, recurrence_period_count
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  for (const prod of seedProducts) {
    insertStmt.run(
      prod.id,
      prod.name,
      prod.category,
      prod.price_cents,
      prod.description,
      prod.image,
      prod.type,
      prod.recurrence_period,
      prod.recurrence_period_count
    );
  }
}

module.exports = db;
