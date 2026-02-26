# Backup & Recovery System
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** CRITICAL
**Estimated Build:** 2-3 days (Brunel)
**Location:** `/workspace/skills/backup-system/`

---

## 1. Overview

Automated backup and recovery for all production data: SQLite databases, JSONL event logs, configuration files, and workspace state. Hourly database backups with encryption, hourly git sync, restore scripts, and periodic integrity drills.

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    backup-system/                         │
├─────────────────────────────────────────────────────────┤
│  discover.js         Auto-discover .db/.sqlite + JSONL   │
│  backup.js           Create backup archive + manifest    │
│  encrypt.js          GPG encryption/decryption           │
│  upload.js           Cloud storage upload (GDrive/S3)    │
│  git-sync.js         Hourly auto-commit + push           │
│  restore.js          Download + decrypt + restore        │
│  integrity.js        Periodic validation drill           │
│  manifest.js         Manifest creation + parsing         │
│  retention.js        Prune old backups beyond retention  │
│  config.json         Paths, schedules, cloud config      │
│  SKILL.md            Integration guide                   │
└─────────────────────────────────────────────────────────┘

Flow:

  Hourly:
  discover.js ──▶ backup.js ──▶ encrypt.js ──▶ upload.js
       │              │
       │         manifest.json
       │              │
       └──▶ retention.js (prune old)

  Hourly:
  git-sync.js ──▶ commit ──▶ pull ──▶ push ──▶ alert on failure

  Weekly:
  integrity.js ──▶ download ──▶ decrypt ──▶ verify checksums
```

## 3. Database Backup

### 3.1 Auto-Discovery (`discover.js`)

```javascript
const fs = require('fs');
const path = require('path');

const SCAN_PATHS = [
  '/Volumes/reeseai-memory/data',
  '/Users/marcusrawlins/.openclaw/workspace/skills',
  '/Users/marcusrawlins/.openclaw/workspace/mission_control/data'
];

const DB_EXTENSIONS = ['.db', '.sqlite', '.sqlite3'];
const LOG_EXTENSIONS = ['.jsonl'];

class BackupDiscovery {
  discover(options = {}) {
    const files = {
      databases: [],
      logs: [],
      configs: []
    };

    for (const scanPath of SCAN_PATHS) {
      if (!fs.existsSync(scanPath)) continue;
      this._walk(scanPath, files, options.maxDepth || 5, 0);
    }

    // Also discover critical config files
    const configFiles = [
      '/Users/marcusrawlins/.openclaw/workspace/MEMORY.md',
      '/Users/marcusrawlins/.openclaw/workspace/SOUL.md',
      '/Users/marcusrawlins/.openclaw/workspace/USER.md',
      '/Users/marcusrawlins/.openclaw/workspace/TOOLS.md',
      '/Users/marcusrawlins/.openclaw/workspace/AGENTS.md',
      '/Users/marcusrawlins/.openclaw/workspace/IDENTITY.md'
    ];

    for (const cf of configFiles) {
      if (fs.existsSync(cf)) files.configs.push(cf);
    }

    return files;
  }

  _walk(dir, files, maxDepth, currentDepth) {
    if (currentDepth > maxDepth) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules, .git, archive dirs
        if (['node_modules', '.git', 'archive'].includes(entry.name)) continue;
        this._walk(fullPath, files, maxDepth, currentDepth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        if (DB_EXTENSIONS.includes(ext)) {
          // Skip WAL/SHM files (they'll be handled with the main DB)
          if (entry.name.endsWith('-wal') || entry.name.endsWith('-shm')) continue;
          files.databases.push(fullPath);
        } else if (LOG_EXTENSIONS.includes(ext)) {
          files.logs.push(fullPath);
        }
      }
    }
  }
}

module.exports = BackupDiscovery;
```

### 3.2 Backup Creator (`backup.js`)

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const BackupDiscovery = require('./discover');
const ManifestBuilder = require('./manifest');
const config = require('./config.json');

class BackupCreator {
  constructor() {
    this.backupDir = config.backup.local_dir;
    this.discovery = new BackupDiscovery();
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);

    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });

    // Discover files
    const files = this.discovery.discover();
    console.log(`Found: ${files.databases.length} databases, ${files.logs.length} logs, ${files.configs.length} configs`);

    const manifest = new ManifestBuilder(backupName, timestamp);

    // Backup databases (use SQLite .backup for safe copy)
    for (const dbPath of files.databases) {
      const destName = this._safeFilename(dbPath);
      const destPath = path.join(backupPath, destName);

      try {
        // Use sqlite3 .backup command for consistent copy (handles WAL mode)
        execSync(`sqlite3 "${dbPath}" ".backup '${destPath}'"`, { timeout: 30000 });
        const stat = fs.statSync(destPath);
        const checksum = this._checksum(destPath);
        manifest.addFile(dbPath, destName, 'database', stat.size, checksum);
        console.log(`  ✓ DB: ${path.basename(dbPath)} (${(stat.size / 1024).toFixed(0)}KB)`);
      } catch (err) {
        // Fallback to file copy if sqlite3 CLI not available
        try {
          fs.copyFileSync(dbPath, destPath);
          const stat = fs.statSync(destPath);
          const checksum = this._checksum(destPath);
          manifest.addFile(dbPath, destName, 'database', stat.size, checksum);
          console.log(`  ✓ DB (copy): ${path.basename(dbPath)} (${(stat.size / 1024).toFixed(0)}KB)`);
        } catch (copyErr) {
          manifest.addError(dbPath, copyErr.message);
          console.log(`  ✗ DB: ${path.basename(dbPath)}: ${copyErr.message}`);
        }
      }
    }

    // Backup JSONL logs
    for (const logPath of files.logs) {
      const destName = this._safeFilename(logPath);
      const destPath = path.join(backupPath, destName);

      try {
        fs.copyFileSync(logPath, destPath);
        const stat = fs.statSync(destPath);
        const checksum = this._checksum(destPath);
        manifest.addFile(logPath, destName, 'log', stat.size, checksum);
      } catch (err) {
        manifest.addError(logPath, err.message);
      }
    }

    // Backup config files
    for (const cfgPath of files.configs) {
      const destName = this._safeFilename(cfgPath);
      const destPath = path.join(backupPath, destName);

      try {
        fs.copyFileSync(cfgPath, destPath);
        const stat = fs.statSync(destPath);
        const checksum = this._checksum(destPath);
        manifest.addFile(cfgPath, destName, 'config', stat.size, checksum);
      } catch (err) {
        manifest.addError(cfgPath, err.message);
      }
    }

    // Write manifest
    const manifestPath = path.join(backupPath, 'manifest.json');
    fs.writeFileSync(manifestPath, manifest.toJSON());

    // Create tar archive
    const tarPath = `${backupPath}.tar.gz`;
    execSync(`tar -czf "${tarPath}" -C "${this.backupDir}" "${backupName}"`, { timeout: 120000 });

    // Clean up uncompressed directory
    fs.rmSync(backupPath, { recursive: true });

    const tarStat = fs.statSync(tarPath);
    console.log(`\nBackup created: ${tarPath} (${(tarStat.size / 1024 / 1024).toFixed(1)}MB)`);

    return {
      path: tarPath,
      name: backupName,
      manifest: manifest.data,
      sizeMB: (tarStat.size / 1024 / 1024).toFixed(1)
    };
  }

  _safeFilename(originalPath) {
    // Convert absolute path to safe filename: /a/b/c.db → a__b__c.db
    return originalPath.replace(/^\//, '').replace(/\//g, '__');
  }

  _checksum(filePath) {
    return execSync(`shasum -a 256 "${filePath}" | cut -d' ' -f1`, { encoding: 'utf8' }).trim();
  }
}

module.exports = BackupCreator;
```

### 3.3 Manifest (`manifest.js`)

```javascript
class ManifestBuilder {
  constructor(backupName, timestamp) {
    this.data = {
      version: '1.0',
      name: backupName,
      created_at: timestamp,
      hostname: require('os').hostname(),
      files: [],
      errors: [],
      totals: {
        databases: 0,
        logs: 0,
        configs: 0,
        total_size_bytes: 0
      }
    };
  }

  addFile(originalPath, backupName, type, sizeBytes, checksum) {
    this.data.files.push({
      original_path: originalPath,
      backup_name: backupName,
      type,
      size_bytes: sizeBytes,
      checksum_sha256: checksum
    });

    this.data.totals[type === 'database' ? 'databases' : type === 'log' ? 'logs' : 'configs']++;
    this.data.totals.total_size_bytes += sizeBytes;
  }

  addError(originalPath, errorMessage) {
    this.data.errors.push({
      original_path: originalPath,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }

  toJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  static fromJSON(jsonString) {
    return JSON.parse(jsonString);
  }
}

module.exports = ManifestBuilder;
```

## 4. Encryption (`encrypt.js`)

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const config = require('./config.json');

class BackupEncryption {
  constructor() {
    this.passphrase = process.env.BACKUP_ENCRYPTION_KEY || config.encryption?.passphrase_env;
  }

  // Encrypt a file with GPG symmetric encryption
  encrypt(inputPath) {
    if (!this.passphrase && !process.env.BACKUP_ENCRYPTION_KEY) {
      console.warn('Warning: No encryption key set. Skipping encryption.');
      return inputPath;
    }

    const outputPath = `${inputPath}.gpg`;
    
    execSync(
      `gpg --batch --yes --symmetric --cipher-algo AES256 --passphrase-fd 0 -o "${outputPath}" "${inputPath}"`,
      {
        input: process.env.BACKUP_ENCRYPTION_KEY || this.passphrase,
        timeout: 300000  // 5 min for large files
      }
    );

    // Remove unencrypted file
    fs.unlinkSync(inputPath);
    
    console.log(`  Encrypted: ${outputPath}`);
    return outputPath;
  }

  // Decrypt a file
  decrypt(inputPath, outputPath) {
    if (!outputPath) {
      outputPath = inputPath.replace(/\.gpg$/, '');
    }

    execSync(
      `gpg --batch --yes --decrypt --passphrase-fd 0 -o "${outputPath}" "${inputPath}"`,
      {
        input: process.env.BACKUP_ENCRYPTION_KEY || this.passphrase,
        timeout: 300000
      }
    );

    console.log(`  Decrypted: ${outputPath}`);
    return outputPath;
  }

  // Check if GPG is available
  static isAvailable() {
    try {
      execSync('gpg --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = BackupEncryption;
```

## 5. Cloud Upload (`upload.js`)

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

class CloudUploader {
  constructor() {
    this.provider = config.cloud?.provider || 'local';
    this.bucket = config.cloud?.bucket;
    this.prefix = config.cloud?.prefix || 'openclaw-backups';
  }

  async upload(filePath) {
    const filename = path.basename(filePath);

    switch (this.provider) {
      case 's3':
        return this._uploadS3(filePath, filename);
      case 'gdrive':
        return this._uploadGDrive(filePath, filename);
      case 'local':
        return this._uploadLocal(filePath, filename);
      default:
        throw new Error(`Unknown cloud provider: ${this.provider}`);
    }
  }

  _uploadS3(filePath, filename) {
    const dest = `s3://${this.bucket}/${this.prefix}/${filename}`;
    execSync(`aws s3 cp "${filePath}" "${dest}"`, { timeout: 600000 });
    console.log(`  Uploaded to S3: ${dest}`);
    return dest;
  }

  _uploadGDrive(filePath, filename) {
    // Using rclone for Google Drive
    const dest = `gdrive:${this.prefix}/${filename}`;
    execSync(`rclone copy "${filePath}" "${dest}"`, { timeout: 600000 });
    console.log(`  Uploaded to Google Drive: ${dest}`);
    return dest;
  }

  _uploadLocal(filePath, filename) {
    // Local backup to secondary drive
    const localDest = config.cloud?.local_backup_dir || '/Volumes/BACKUP/reeseai-backup';
    if (!fs.existsSync(localDest)) fs.mkdirSync(localDest, { recursive: true });
    
    const destPath = path.join(localDest, filename);
    fs.copyFileSync(filePath, destPath);
    console.log(`  Copied to local backup: ${destPath}`);
    return destPath;
  }

  // List remote backups
  async listRemote() {
    switch (this.provider) {
      case 's3':
        return execSync(`aws s3 ls s3://${this.bucket}/${this.prefix}/ --human-readable`, { encoding: 'utf8' });
      case 'gdrive':
        return execSync(`rclone ls gdrive:${this.prefix}/`, { encoding: 'utf8' });
      case 'local': {
        const localDir = config.cloud?.local_backup_dir || '/Volumes/BACKUP/reeseai-backup';
        if (!fs.existsSync(localDir)) return 'No backups found';
        return fs.readdirSync(localDir).join('\n');
      }
      default:
        return 'Unknown provider';
    }
  }

  // Download a specific backup
  async download(backupName, destPath) {
    switch (this.provider) {
      case 's3':
        execSync(`aws s3 cp s3://${this.bucket}/${this.prefix}/${backupName} "${destPath}"`, { timeout: 600000 });
        break;
      case 'gdrive':
        execSync(`rclone copy gdrive:${this.prefix}/${backupName} "${path.dirname(destPath)}"`, { timeout: 600000 });
        break;
      case 'local': {
        const localDir = config.cloud?.local_backup_dir || '/Volumes/BACKUP/reeseai-backup';
        fs.copyFileSync(path.join(localDir, backupName), destPath);
        break;
      }
    }
    console.log(`  Downloaded: ${destPath}`);
    return destPath;
  }
}

module.exports = CloudUploader;
```

## 6. Git Sync (`git-sync.js`)

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const PID_FILE = '/tmp/openclaw-git-sync.pid';

class GitSync {
  constructor() {
    this.repoPath = config.git_sync?.repo_path || '/tmp/openclaw-platform';
    this.sourcePaths = config.git_sync?.source_paths || {
      skills: '/Users/marcusrawlins/.openclaw/workspace/skills',
      specs: '/Users/marcusrawlins/.openclaw/workspace/specs'
    };
  }

  async sync() {
    // PID file guard
    if (this._isRunning()) {
      console.log('Git sync already running. Skipping.');
      return { status: 'skipped', reason: 'already_running' };
    }
    this._writePid();

    try {
      // Ensure repo exists
      if (!fs.existsSync(path.join(this.repoPath, '.git'))) {
        execSync(`git clone https://github.com/MarcusRawlins/openclaw-platform.git "${this.repoPath}"`, { timeout: 30000 });
      }

      const cwd = this.repoPath;

      // Pull first to handle remote changes
      try {
        execSync('git pull origin main --rebase', { cwd, timeout: 30000, stdio: 'pipe' });
      } catch (pullErr) {
        // If rebase fails, abort and try merge
        try { execSync('git rebase --abort', { cwd, stdio: 'pipe' }); } catch {}
        execSync('git pull origin main', { cwd, timeout: 30000, stdio: 'pipe' });
      }

      // Sync modules
      for (const [key, sourcePath] of Object.entries(this.sourcePaths)) {
        if (!fs.existsSync(sourcePath)) continue;

        if (key === 'skills') {
          const dirs = fs.readdirSync(sourcePath, { withFileTypes: true }).filter(d => d.isDirectory());
          for (const dir of dirs) {
            const src = path.join(sourcePath, dir.name);
            const dest = path.join(cwd, 'modules', dir.name);
            execSync(`rm -rf "${dest}" && cp -r "${src}" "${dest}" && rm -rf "${dest}/node_modules"`, { timeout: 10000 });
          }
        } else if (key === 'specs') {
          const dest = path.join(cwd, 'specs');
          execSync(`rm -rf "${dest}" && mkdir -p "${dest}" && cp "${sourcePath}"/*.md "${dest}/"`, { timeout: 10000 });
        }
      }

      // Secret scan
      try {
        const secrets = execSync(
          `grep -rl "sk_live\\|rk_live\\|pk_live" modules/ 2>/dev/null || true`,
          { cwd, encoding: 'utf8', timeout: 10000 }
        ).trim();
        if (secrets) {
          throw new Error(`Secrets detected in: ${secrets}`);
        }
      } catch (scanErr) {
        if (scanErr.message.includes('Secrets detected')) throw scanErr;
      }

      // Check for changes
      const status = execSync('git status --porcelain', { cwd, encoding: 'utf8' }).trim();
      if (!status) {
        return { status: 'clean', message: 'No changes to sync' };
      }

      // Commit and push
      const date = new Date().toISOString().substring(0, 10);
      execSync('git add -A', { cwd, timeout: 10000 });
      const diffStat = execSync('git diff --cached --stat | tail -1', { cwd, encoding: 'utf8' }).trim();
      execSync(`git commit -m "Sync ${date}: ${diffStat}"`, { cwd, timeout: 10000 });
      execSync('git push origin main', { cwd, timeout: 60000 });

      return { status: 'pushed', changes: diffStat };
    } catch (error) {
      return { status: 'error', error: error.message };
    } finally {
      this._removePid();
    }
  }

  _isRunning() {
    if (!fs.existsSync(PID_FILE)) return false;
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    try {
      process.kill(pid, 0); // Check if process exists
      return true;
    } catch {
      // Stale PID file
      fs.unlinkSync(PID_FILE);
      return false;
    }
  }

  _writePid() {
    fs.writeFileSync(PID_FILE, String(process.pid));
  }

  _removePid() {
    try { fs.unlinkSync(PID_FILE); } catch {}
  }
}

module.exports = GitSync;
```

## 7. Restore Script (`restore.js`)

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const BackupEncryption = require('./encrypt');
const CloudUploader = require('./upload');
const ManifestBuilder = require('./manifest');
const config = require('./config.json');

class BackupRestore {
  constructor() {
    this.encryption = new BackupEncryption();
    this.uploader = new CloudUploader();
    this.tempDir = '/tmp/openclaw-restore';
  }

  // List available backups
  async list() {
    const remoteList = await this.uploader.listRemote();
    console.log('Available backups:');
    console.log(remoteList);
    return remoteList;
  }

  // Preview what would be restored (dry run)
  async preview(backupName) {
    const manifest = await this._getManifest(backupName);
    
    console.log(`\nBackup: ${manifest.name}`);
    console.log(`Created: ${manifest.created_at}`);
    console.log(`Files: ${manifest.files.length}`);
    console.log(`\nWould restore:`);
    
    for (const file of manifest.files) {
      const exists = fs.existsSync(file.original_path);
      const status = exists ? '(overwrite)' : '(new)';
      console.log(`  ${file.type.padEnd(10)} ${file.original_path} ${status}`);
    }

    if (manifest.errors?.length > 0) {
      console.log(`\nBackup errors (these files were NOT backed up):`);
      for (const err of manifest.errors) {
        console.log(`  ✗ ${err.original_path}: ${err.error}`);
      }
    }

    return manifest;
  }

  // Full restore
  async restore(backupName, options = {}) {
    const force = options.force || false;
    
    if (!force) {
      console.log('DRY RUN (use --force to actually restore):');
      return this.preview(backupName);
    }

    console.log(`\nRestoring from: ${backupName}`);

    // Clean temp dir
    if (fs.existsSync(this.tempDir)) fs.rmSync(this.tempDir, { recursive: true });
    fs.mkdirSync(this.tempDir, { recursive: true });

    // Download backup
    const downloadPath = path.join(this.tempDir, backupName);
    let archivePath;

    if (backupName.endsWith('.gpg')) {
      // Download encrypted
      await this.uploader.download(backupName, downloadPath);
      // Decrypt
      archivePath = this.encryption.decrypt(downloadPath);
    } else {
      await this.uploader.download(backupName, downloadPath);
      archivePath = downloadPath;
    }

    // Extract
    const extractDir = path.join(this.tempDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { timeout: 120000 });

    // Find manifest
    const manifestFiles = execSync(`find "${extractDir}" -name manifest.json`, { encoding: 'utf8' }).trim().split('\n');
    if (manifestFiles.length === 0 || !manifestFiles[0]) {
      throw new Error('No manifest.json found in backup');
    }

    const manifest = ManifestBuilder.fromJSON(fs.readFileSync(manifestFiles[0], 'utf8'));
    const backupDir = path.dirname(manifestFiles[0]);

    console.log(`\nRestoring ${manifest.files.length} files...`);

    let restored = 0;
    let failed = 0;

    for (const file of manifest.files) {
      const sourcePath = path.join(backupDir, file.backup_name);
      
      if (!fs.existsSync(sourcePath)) {
        console.log(`  ✗ Missing in backup: ${file.backup_name}`);
        failed++;
        continue;
      }

      try {
        // Verify checksum
        const checksum = execSync(`shasum -a 256 "${sourcePath}" | cut -d' ' -f1`, { encoding: 'utf8' }).trim();
        if (checksum !== file.checksum_sha256) {
          console.log(`  ✗ Checksum mismatch: ${file.original_path}`);
          failed++;
          continue;
        }

        // Ensure destination directory exists
        const destDir = path.dirname(file.original_path);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

        // Restore
        fs.copyFileSync(sourcePath, file.original_path);
        restored++;
        console.log(`  ✓ ${file.type}: ${file.original_path}`);
      } catch (err) {
        console.log(`  ✗ ${file.original_path}: ${err.message}`);
        failed++;
      }
    }

    // Clean up
    fs.rmSync(this.tempDir, { recursive: true });

    console.log(`\nRestore complete: ${restored} succeeded, ${failed} failed`);
    return { restored, failed, total: manifest.files.length };
  }

  async _getManifest(backupName) {
    // Download just the manifest for preview
    const tempPath = path.join(this.tempDir || '/tmp', 'manifest-preview');
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true });
    fs.mkdirSync(tempPath, { recursive: true });

    const archivePath = path.join(tempPath, backupName);
    await this.uploader.download(backupName, archivePath);

    if (backupName.endsWith('.gpg')) {
      const decrypted = this.encryption.decrypt(archivePath);
      execSync(`tar -xzf "${decrypted}" -C "${tempPath}"`, { timeout: 60000 });
    } else {
      execSync(`tar -xzf "${archivePath}" -C "${tempPath}"`, { timeout: 60000 });
    }

    const manifestFile = execSync(`find "${tempPath}" -name manifest.json`, { encoding: 'utf8' }).trim().split('\n')[0];
    const manifest = ManifestBuilder.fromJSON(fs.readFileSync(manifestFile, 'utf8'));

    fs.rmSync(tempPath, { recursive: true });
    return manifest;
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const restore = new BackupRestore();

  if (args[0] === 'list' || args.length === 0) {
    restore.list();
  } else if (args[0] === 'preview' && args[1]) {
    restore.preview(args[1]);
  } else if (args[0] === 'restore' && args[1]) {
    const force = args.includes('--force');
    restore.restore(args[1], { force });
  } else {
    console.log(`Usage:
  node restore.js list                     List available backups
  node restore.js preview <backup-name>    Preview what would be restored
  node restore.js restore <backup-name>    Dry run (shows what would happen)
  node restore.js restore <backup-name> --force   Actually restore`);
  }
}

module.exports = BackupRestore;
```

## 8. Integrity Drill (`integrity.js`)

```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const BackupEncryption = require('./encrypt');
const CloudUploader = require('./upload');
const ManifestBuilder = require('./manifest');
const config = require('./config.json');

class IntegrityDrill {
  constructor() {
    this.encryption = new BackupEncryption();
    this.uploader = new CloudUploader();
    this.drillDir = '/tmp/openclaw-integrity-drill';
  }

  async run() {
    console.log('\n══════ BACKUP INTEGRITY DRILL ══════\n');
    
    const results = {
      timestamp: new Date().toISOString(),
      checks: [],
      passed: 0,
      failed: 0
    };

    // Step 1: List remote backups
    await this._check(results, 'List remote backups', async () => {
      const list = await this.uploader.listRemote();
      if (!list || list === 'No backups found') throw new Error('No backups found');
      return `Found backups`;
    });

    // Step 2: Download latest backup
    let latestBackup;
    await this._check(results, 'Download latest backup', async () => {
      const localDir = config.cloud?.local_backup_dir || '/Volumes/BACKUP/reeseai-backup';
      const files = fs.readdirSync(localDir).filter(f => f.startsWith('backup-')).sort().reverse();
      if (files.length === 0) throw new Error('No backup files found');
      
      latestBackup = files[0];
      
      if (fs.existsSync(this.drillDir)) fs.rmSync(this.drillDir, { recursive: true });
      fs.mkdirSync(this.drillDir, { recursive: true });
      
      const src = path.join(localDir, latestBackup);
      const dest = path.join(this.drillDir, latestBackup);
      fs.copyFileSync(src, dest);
      
      return `Downloaded: ${latestBackup}`;
    });

    // Step 3: Decrypt (if encrypted)
    let archivePath;
    await this._check(results, 'Decrypt backup', async () => {
      const downloadedPath = path.join(this.drillDir, latestBackup);
      
      if (latestBackup.endsWith('.gpg')) {
        archivePath = this.encryption.decrypt(downloadedPath);
        return 'Decrypted successfully';
      } else {
        archivePath = downloadedPath;
        return 'Not encrypted (skipped)';
      }
    });

    // Step 4: Extract and parse manifest
    let manifest;
    await this._check(results, 'Parse manifest', async () => {
      const extractDir = path.join(this.drillDir, 'extracted');
      fs.mkdirSync(extractDir, { recursive: true });
      execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { timeout: 60000 });
      
      const manifestFile = execSync(`find "${extractDir}" -name manifest.json`, { encoding: 'utf8' }).trim().split('\n')[0];
      if (!manifestFile) throw new Error('manifest.json not found');
      
      manifest = ManifestBuilder.fromJSON(fs.readFileSync(manifestFile, 'utf8'));
      return `Manifest: ${manifest.files.length} files, created ${manifest.created_at}`;
    });

    // Step 5: Verify checksums
    await this._check(results, 'Verify checksums', async () => {
      const extractDir = path.join(this.drillDir, 'extracted');
      const backupDir = execSync(`find "${extractDir}" -name manifest.json -exec dirname {} \\;`, { encoding: 'utf8' }).trim();
      
      let matched = 0;
      let mismatched = 0;
      
      for (const file of manifest.files) {
        const filePath = path.join(backupDir, file.backup_name);
        if (!fs.existsSync(filePath)) {
          mismatched++;
          continue;
        }
        
        const checksum = execSync(`shasum -a 256 "${filePath}" | cut -d' ' -f1`, { encoding: 'utf8' }).trim();
        if (checksum === file.checksum_sha256) {
          matched++;
        } else {
          mismatched++;
        }
      }
      
      if (mismatched > 0) throw new Error(`${mismatched} checksum mismatches`);
      return `${matched}/${manifest.files.length} checksums verified`;
    });

    // Step 6: Verify databases are readable
    await this._check(results, 'Database integrity', async () => {
      const extractDir = path.join(this.drillDir, 'extracted');
      const backupDir = execSync(`find "${extractDir}" -name manifest.json -exec dirname {} \\;`, { encoding: 'utf8' }).trim();
      
      const dbFiles = manifest.files.filter(f => f.type === 'database');
      let readable = 0;
      
      for (const file of dbFiles) {
        const filePath = path.join(backupDir, file.backup_name);
        if (!fs.existsSync(filePath)) continue;
        
        try {
          execSync(`sqlite3 "${filePath}" "PRAGMA integrity_check"`, { timeout: 10000, stdio: 'pipe' });
          readable++;
        } catch {
          // DB not readable
        }
      }
      
      return `${readable}/${dbFiles.length} databases pass integrity check`;
    });

    // Clean up
    if (fs.existsSync(this.drillDir)) fs.rmSync(this.drillDir, { recursive: true });

    // Summary
    console.log(`\n══════ DRILL COMPLETE ══════`);
    console.log(`Passed: ${results.passed}  Failed: ${results.failed}`);
    console.log(`${results.failed === 0 ? '✓ ALL CHECKS PASSED' : '✗ FAILURES DETECTED'}\n`);

    return results;
  }

  async _check(results, name, fn) {
    try {
      const detail = await fn();
      results.checks.push({ name, status: 'pass', detail });
      results.passed++;
      console.log(`  ✓ ${name}: ${detail}`);
    } catch (err) {
      results.checks.push({ name, status: 'fail', error: err.message });
      results.failed++;
      console.log(`  ✗ ${name}: ${err.message}`);
    }
  }
}

// CLI
if (require.main === module) {
  const drill = new IntegrityDrill();
  drill.run().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

module.exports = IntegrityDrill;
```

## 9. Retention (`retention.js`)

```javascript
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

class RetentionManager {
  constructor() {
    this.keepCount = config.backup?.retention_count || 7;
    this.localDir = config.backup?.local_dir;
    this.cloudDir = config.cloud?.local_backup_dir || '/Volumes/BACKUP/reeseai-backup';
  }

  // Prune local staging backups
  pruneLocal() {
    return this._pruneDir(this.localDir, 'staging');
  }

  // Prune cloud/backup drive backups
  pruneCloud() {
    return this._pruneDir(this.cloudDir, 'backup drive');
  }

  _pruneDir(dir, label) {
    if (!dir || !fs.existsSync(dir)) return { pruned: 0 };

    const backups = fs.readdirSync(dir)
      .filter(f => f.startsWith('backup-'))
      .sort()
      .reverse();

    if (backups.length <= this.keepCount) {
      console.log(`  ${label}: ${backups.length} backups (within retention of ${this.keepCount})`);
      return { pruned: 0 };
    }

    const toDelete = backups.slice(this.keepCount);
    for (const file of toDelete) {
      const filePath = path.join(dir, file);
      fs.rmSync(filePath, { recursive: true });
      console.log(`  Pruned: ${file}`);
    }

    console.log(`  ${label}: pruned ${toDelete.length} old backups, kept ${this.keepCount}`);
    return { pruned: toDelete.length };
  }
}

module.exports = RetentionManager;
```

## 10. Configuration (`config.json`)

```json
{
  "backup": {
    "local_dir": "/tmp/openclaw-backups",
    "retention_count": 7,
    "scan_paths": [
      "/Volumes/reeseai-memory/data",
      "/Users/marcusrawlins/.openclaw/workspace/skills",
      "/Users/marcusrawlins/.openclaw/workspace/mission_control/data"
    ]
  },
  "encryption": {
    "enabled": true,
    "passphrase_env": "BACKUP_ENCRYPTION_KEY",
    "cipher": "AES256"
  },
  "cloud": {
    "provider": "local",
    "local_backup_dir": "/Volumes/BACKUP/reeseai-backup",
    "bucket": null,
    "prefix": "openclaw-backups"
  },
  "git_sync": {
    "repo_path": "/tmp/openclaw-platform",
    "remote": "https://github.com/MarcusRawlins/openclaw-platform.git",
    "source_paths": {
      "skills": "/Users/marcusrawlins/.openclaw/workspace/skills",
      "specs": "/Users/marcusrawlins/.openclaw/workspace/specs"
    }
  },
  "integrity": {
    "schedule": "weekly",
    "drill_dir": "/tmp/openclaw-integrity-drill"
  }
}
```

## 11. CLI Interface

```bash
# Run full backup
node backup-system/backup.js

# Run git sync
node backup-system/git-sync.js

# List backups
node backup-system/restore.js list

# Preview restore
node backup-system/restore.js preview backup-2026-02-26T10-00-00.tar.gz

# Actual restore
node backup-system/restore.js restore backup-2026-02-26T10-00-00.tar.gz --force

# Integrity drill
node backup-system/integrity.js

# Prune old backups
node backup-system/retention.js
```

## 12. Cron Integration

```json
[
  {
    "name": "backup-hourly",
    "schedule": { "kind": "cron", "expr": "0 * * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run hourly backup: node /workspace/skills/backup-system/backup.js\nReport if any databases failed to back up." },
    "sessionTarget": "isolated"
  },
  {
    "name": "git-sync-hourly",
    "schedule": { "kind": "cron", "expr": "30 * * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run git sync: node /workspace/skills/backup-system/git-sync.js\nReport result. Alert if push failed." },
    "sessionTarget": "isolated"
  },
  {
    "name": "integrity-drill-weekly",
    "schedule": { "kind": "cron", "expr": "0 3 * * 0", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run backup integrity drill: node /workspace/skills/backup-system/integrity.js\nReport results. Alert if any check failed." },
    "sessionTarget": "isolated",
    "delivery": { "mode": "announce" }
  },
  {
    "name": "backup-retention-daily",
    "schedule": { "kind": "cron", "expr": "0 4 * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run backup retention: node /workspace/skills/backup-system/retention.js" },
    "sessionTarget": "isolated"
  }
]
```

## 13. File Structure

```
/workspace/skills/backup-system/
├── discover.js            # Auto-discover databases + logs
├── backup.js              # Create backup archive + manifest
├── encrypt.js             # GPG encryption/decryption
├── upload.js              # Cloud storage upload
├── git-sync.js            # Hourly git auto-commit + push
├── restore.js             # Download + decrypt + restore
├── integrity.js           # Periodic validation drill
├── manifest.js            # Manifest creation + parsing
├── retention.js           # Prune old backups
├── config.json            # All configuration
├── SKILL.md               # Integration guide
├── README.md              # Overview
└── package.json           # Dependencies
```

## 14. Testing Checklist

- [ ] Discovery: finds all .db files across scan paths
- [ ] Discovery: finds all .jsonl log files
- [ ] Discovery: skips node_modules and .git
- [ ] Backup: creates tar.gz with manifest
- [ ] Backup: uses sqlite3 .backup for safe DB copy
- [ ] Backup: SHA-256 checksums for all files
- [ ] Encryption: GPG encrypt/decrypt round-trip
- [ ] Upload: local copy to backup drive works
- [ ] Git sync: PID file prevents concurrent runs
- [ ] Git sync: pulls before pushing
- [ ] Git sync: secret scan blocks push with secrets
- [ ] Git sync: alerts on failure
- [ ] Restore: list mode shows available backups
- [ ] Restore: preview mode shows what would happen
- [ ] Restore: force mode actually restores
- [ ] Restore: checksum verification catches corruption
- [ ] Integrity: downloads, decrypts, parses manifest, verifies checksums
- [ ] Integrity: does NOT modify current filesystem
- [ ] Retention: keeps exactly N most recent backups
- [ ] Retention: deletes oldest first
