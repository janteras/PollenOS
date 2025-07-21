const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class MigrationRunner {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/local/pollenos.db');
    this.migrationsDir = path.join(__dirname, '../migrations');
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(err);
        this.db.run('PRAGMA foreign_keys = ON');
        resolve();
      });
    });
  }

  async ensureMigrationsTable() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async getExecutedMigrations() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT name FROM migrations ORDER BY id', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => row.name));
      });
    });
  }

  async getPendingMigrations() {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    const executed = await this.getExecutedMigrations();
    return files.filter(file => !executed.includes(file));
  }

  async runMigration(file) {
    return new Promise((resolve, reject) => {
      const migrationPath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Split SQL by semicolon and execute each statement
        const statements = sql.split(';').filter(s => s.trim() !== '');
        
        const executeStatements = (index) => {
          if (index >= statements.length) {
            // All statements executed successfully
            this.db.run('COMMIT', (err) => {
              if (err) return this.rollbackAndReject(err, reject);
              
              // Record migration
              this.db.run(
                'INSERT INTO migrations (name) VALUES (?)',
                [file],
                (err) => {
                  if (err) return reject(err);
                  console.log(`✅ Applied migration: ${file}`);
                  resolve();
                }
              );
            });
            return;
          }
          
          const statement = statements[index].trim();
          if (statement) {
            this.db.run(statement, (err) => {
              if (err) {
                console.error(`Error executing statement in ${file}:`, statement, err);
                return this.rollbackAndReject(err, reject);
              }
              executeStatements(index + 1);
            });
          } else {
            executeStatements(index + 1);
          }
        };
        
        executeStatements(0);
      });
    });
  }

  rollbackAndReject(err, reject) {
    this.db.run('ROLLBACK', () => {
      reject(err);
    });
  }

  async run() {
    try {
      console.log('🚀 Starting database migrations...');
      await this.connect();
      await this.ensureMigrationsTable();
      
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations.');
        return;
      }
      
      console.log(`🔍 Found ${pendingMigrations.length} pending migrations`);
      
      for (const migration of pendingMigrations) {
        console.log(`🔄 Applying migration: ${migration}`);
        await this.runMigration(migration);
      }
      
      console.log('✅ All migrations completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.run();
}

module.exports = MigrationRunner;
