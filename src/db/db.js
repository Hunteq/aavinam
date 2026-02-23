import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.VITE_NEON_DATABASE_URL, { disableWarningInBrowsers: true });

// Helper to handle both { rows: [] } and direct [] results from Neon query
const getRows = (result) => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result.rows && Array.isArray(result.rows)) return result.rows;
  return [];
};

const NUMERIC_FIELDS = {
  entries: ['quantity', 'fat', 'snf', 'rate', 'amount', 'branchId', 'farmerId'],
  farmers: ['branchId'],
  rates: ['branchId', 'isActive'],
  products: ['branchId', 'price'],
  notifications: ['branchId']
};

const castRow = (tableName, row) => {
  if (!row) return row;
  const fields = NUMERIC_FIELDS[tableName];
  if (!fields) return row;

  const newRow = { ...row };
  for (const field of fields) {
    if (newRow[field] !== undefined && newRow[field] !== null) {
      newRow[field] = Number(newRow[field]);
    }
  }
  return newRow;
};

const prepareValue = (v) => {
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
    return JSON.stringify(v);
  }
  return v;
};

class Collection {
  constructor(tableName, baseQuery, params = []) {
    this.tableName = tableName;
    this.baseQuery = baseQuery;
    this.params = params;
    this._limit = null;
    this._offset = null;
    this._reverse = false;
    this._filters = [];
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  offset(n) {
    this._offset = n;
    return this;
  }

  reverse() {
    this._reverse = true;
    return this;
  }

  filter(fn) {
    this._filters.push(fn);
    return this;
  }

  async toArray() {
    try {
      let query = this.baseQuery;
      if (this._reverse) {
        // Simple heuristic: if query already has ORDER BY, we might need a subquery
        if (query.toUpperCase().includes('ORDER BY')) {
          query = `SELECT * FROM (${query}) AS sub ORDER BY id DESC`;
        } else {
          query += ` ORDER BY id DESC`;
        }
      }
      if (this._limit !== null) {
        query += ` LIMIT ${this._limit}`;
      }
      if (this._offset !== null) {
        query += ` OFFSET ${this._offset}`;
      }

      const result = await sql.query(query, this.params);
      let rows = getRows(result);

      // Cast numeric fields
      rows = rows.map(row => castRow(this.tableName, row));

      // Apply in-memory filters if any
      if (this._filters.length > 0) {
        for (const f of this._filters) {
          rows = rows.filter(f);
        }
      }

      return rows;
    } catch (error) {
      console.error(`Error in Collection.toArray for ${this.tableName}:`, error);
      return [];
    }
  }

  async count() {
    try {
      if (this._filters.length > 0) {
        const rows = await this.toArray();
        return rows.length;
      }

      // If no local filters, we can do a SQL COUNT
      // Heuristic: swap first SELECT * with SELECT COUNT(*)
      const countQuery = this.baseQuery.replace(/SELECT \* /i, 'SELECT COUNT(*) ');
      const result = await sql.query(countQuery, this.params);
      const rows = getRows(result);
      return parseInt(rows[0]?.count || 0);
    } catch (error) {
      console.error(`Error in Collection.count for ${this.tableName}:`, error);
      return 0;
    }
  }

  async first() {
    const rows = await this.limit(1).toArray();
    return rows[0] || null;
  }

  async delete() {
    try {
      const deleteQuery = this.baseQuery.replace(/SELECT \* /i, 'DELETE ');
      await sql.query(deleteQuery, this.params);
    } catch (error) {
      console.error(`Error in Collection.delete for ${this.tableName}:`, error);
      throw error;
    }
  }
}

// Simple Dexie-like wrapper for NeonDB
class Table {
  constructor(name) {
    this.name = name;
  }

  async toArray() {
    return new Collection(this.name, `SELECT * FROM "${this.name}"`).toArray();
  }

  async get(id) {
    try {
      if (id === undefined || id === null) return null;
      const result = await sql.query(`SELECT * FROM "${this.name}" WHERE id = $1`, [id]);
      const rows = getRows(result);
      return rows[0] ? castRow(this.name, rows[0]) : null;
    } catch (error) {
      console.error(`Error in ${this.name}.get:`, error);
      return null;
    }
  }

  async count() {
    return new Collection(this.name, `SELECT * FROM "${this.name}"`).count();
  }

  async add(data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data).map(prepareValue);
      const columns = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const result = await sql.query(`INSERT INTO "${this.name}" (${columns}) VALUES (${placeholders}) RETURNING id`, values);
      const rows = getRows(result);
      return rows[0] ? rows[0].id : null;
    } catch (error) {
      console.error(`Error in ${this.name}.add to ${this.name}:`, error);
      throw error;
    }
  }

  async put(data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data).map(prepareValue);
      const columns = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      // UPSERT logic: INSERT ... ON CONFLICT (id) DO UPDATE
      const updateClause = keys
        .filter(k => k !== 'id')
        .map((k, i) => {
          // Find original index in keys to get correct placeholder $X
          const originalIdx = keys.indexOf(k);
          return `"${k}" = $${originalIdx + 1}`;
        })
        .join(', ');

      let query = `INSERT INTO "${this.name}" (${columns}) VALUES (${placeholders})`;
      if (updateClause) {
        query += ` ON CONFLICT (id) DO UPDATE SET ${updateClause}`;
      } else {
        query += ` ON CONFLICT (id) DO NOTHING`;
      }
      query += ` RETURNING id`;

      const result = await sql.query(query, values);
      const rows = getRows(result);
      return rows[0] ? rows[0].id : null;
    } catch (error) {
      console.error(`Error in ${this.name}.put to ${this.name}:`, error);
      throw error;
    }
  }

  async update(id, data) {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data).map(prepareValue);
      const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');

      await sql.query(`UPDATE "${this.name}" SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
      return 1;
    } catch (error) {
      console.error(`Error in ${this.name}.update in ${this.name}:`, error);
      throw error;
    }
  }

  async delete(id) {
    try {
      await sql.query(`DELETE FROM "${this.name}" WHERE id = $1`, [id]);
      return 1;
    } catch (error) {
      console.error(`Error in ${this.name}.delete in ${this.name}:`, error);
      throw error;
    }
  }

  async bulkAdd(dataArray) {
    for (const item of dataArray) {
      await this.add(item);
    }
  }

  async clear() {
    await sql.query(`DELETE FROM "${this.name}"`);
  }

  where(query) {
    if (typeof query === 'string') {
      return {
        equals: (val) => {
          return new Collection(this.name, `SELECT * FROM "${this.name}" WHERE "${query}" = $1`, [val]);
        }
      };
    } else if (typeof query === 'object') {
      const keys = Object.keys(query);
      const whereClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(' AND ');
      const values = Object.values(query);
      return new Collection(this.name, `SELECT * FROM "${this.name}" WHERE ${whereClause}`, values);
    }
    return new Collection(this.name, `SELECT * FROM "${this.name}"`);
  }
}

export const db = {
  branches: new Table('branches'),
  farmers: new Table('farmers'),
  entries: new Table('entries'),
  rates: new Table('rates'),
  products: new Table('products'),
  settings: new Table('settings'),
  notifications: new Table('notifications'),
  tables: [
    { name: 'branches' },
    { name: 'farmers' },
    { name: 'entries' },
    { name: 'rates' },
    { name: 'products' },
    { name: 'settings' },
    { name: 'notifications' }
  ],

  // Compatibility methods for Dexie
  open: async () => {
    return Promise.resolve();
  },

  transaction: async (mode, tables, callback) => {
    return await callback();
  },

  version: () => ({
    stores: () => { }
  })
};

// Initialize schema
export async function initSchema() {
  try {
    const queries = [
      `CREATE TABLE IF NOT EXISTS "branches" (id SERIAL PRIMARY KEY, "name" TEXT, "location" TEXT, "memberName" TEXT, "memberMobile" TEXT, "contactNumber" TEXT, "type" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "farmers" (id SERIAL PRIMARY KEY, "branchId" INTEGER, "name" TEXT, "milkType" TEXT, "phone" TEXT, "shift" TEXT, "status" TEXT, "manualId" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "entries" (id SERIAL PRIMARY KEY, "branchId" INTEGER, "farmerId" INTEGER, "date" DATE, "shift" TEXT, "milkType" TEXT, "quantity" NUMERIC, "fat" NUMERIC, "snf" NUMERIC, "rate" NUMERIC, "amount" NUMERIC, "qualityNote" TEXT, "timestamp" TIMESTAMP, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "rates" (id SERIAL PRIMARY KEY, "branchId" INTEGER, "milkType" TEXT, "method" TEXT, "config" JSONB, "isActive" INTEGER, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "products" (id SERIAL PRIMARY KEY, "branchId" INTEGER, "name" TEXT, "price" NUMERIC, "unit" TEXT, "category" TEXT, "active" BOOLEAN, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "settings" (id TEXT PRIMARY KEY, "societyName" TEXT, "location" TEXT, "ownerMobile" TEXT, "pin" TEXT, "language" TEXT, "owners" JSONB, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "notifications" (id SERIAL PRIMARY KEY, "branchId" INTEGER, "type" TEXT, "message" TEXT, "timestamp" TIMESTAMP, "status" TEXT, "createdAt" TIMESTAMP, "updatedAt" TIMESTAMP)`
    ];

    for (const q of queries) {
      await sql.query(q);
    }

    // Add default settings if not exists using ON CONFLICT
    await sql.query(`
      INSERT INTO "settings" (id, "societyName", "location", "ownerMobile", "pin", "language")
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `, ['global', 'Milk Society', '', '', '', 'en']);

    // Sync missing columns for existing tables
    const columnAdditions = [
      ['branches', 'createdAt', 'TIMESTAMP'],
      ['branches', 'updatedAt', 'TIMESTAMP'],
      ['branches', 'contactNumber', 'TEXT'],
      ['farmers', 'createdAt', 'TIMESTAMP'],
      ['farmers', 'updatedAt', 'TIMESTAMP'],
      ['products', 'unit', 'TEXT'],
      ['products', 'category', 'TEXT'],
      ['products', 'createdAt', 'TIMESTAMP'],
      ['products', 'updatedAt', 'TIMESTAMP'],
      ['rates', 'createdAt', 'TIMESTAMP'],
      ['rates', 'updatedAt', 'TIMESTAMP'],
      ['settings', 'createdAt', 'TIMESTAMP'],
      ['settings', 'updatedAt', 'TIMESTAMP'],
      ['notifications', 'createdAt', 'TIMESTAMP'],
      ['notifications', 'updatedAt', 'TIMESTAMP'],
      ['entries', 'createdAt', 'TIMESTAMP'],
      ['entries', 'updatedAt', 'TIMESTAMP']
    ];

    for (const [table, column, type] of columnAdditions) {
      try {
        await sql.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${type}`);
      } catch (err) {
        console.error(`Error adding column ${column} to ${table}:`, err);
      }
    }

    console.log("Database schema initialized successfully");
  } catch (error) {
    console.error("Schema initialization failed:", error);
  }
}

// Global initialization
if (typeof window !== 'undefined') {
  initSchema();
}

export async function resetDatabase() {
  const tableNames = ['entries', 'farmers', 'branches', 'rates', 'products', 'notifications', 'settings'];
  for (const name of tableNames) {
    await sql.query(`DROP TABLE IF EXISTS "${name}" CASCADE`);
  }
  await initSchema();
  window.location.reload();
}

export async function exportDatabase() {
  const allData = {};
  for (const table of db.tables) {
    allData[table.name] = await db[table.name].toArray();
  }
  return JSON.stringify(allData, null, 2);
}

export async function importDatabase(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    for (const tableName in data) {
      if (db[tableName]) {
        await db[tableName].clear();
        await db[tableName].bulkAdd(data[tableName]);
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
