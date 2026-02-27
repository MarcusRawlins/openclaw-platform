#!/usr/bin/env ts-node

/**
 * Test Foundation Script
 * Verifies all Phase 1 components are working
 */

import { prisma } from '@/lib/prisma';
import { ConnectionManager } from '@/lib/integrations/connection-manager';
import { SyncScheduler } from '@/lib/integrations/sync-scheduler';
import { encryptToken, decryptToken, generateEncryptionKey } from '@/lib/security/encrypt';

console.log('\n🧪 Testing AnselAI Foundation...\n');

let allTestsPassed = true;

// Test 1: Database Connection
async function testDatabaseConnection() {
  console.log('1️⃣  Testing database connection...');
  try {
    await prisma.$connect();
    const count = await prisma.user.count();
    console.log(`   ✅ Database connected (${count} users)`);
    return true;
  } catch (error) {
    console.error('   ❌ Database connection failed:', error);
    return false;
  }
}

// Test 2: Token Encryption
function testTokenEncryption() {
  console.log('2️⃣  Testing token encryption...');
  try {
    const originalToken = 'test_access_token_12345';
    const encrypted = encryptToken(originalToken);
    const decrypted = decryptToken(encrypted);

    if (decrypted === originalToken) {
      console.log('   ✅ Token encryption/decryption working');
      return true;
    } else {
      console.error('   ❌ Decrypted token does not match original');
      return false;
    }
  } catch (error) {
    console.error('   ❌ Token encryption failed:', error);
    return false;
  }
}

// Test 3: ConnectionManager - Save/Retrieve
async function testConnectionManager() {
  console.log('3️⃣  Testing ConnectionManager...');
  try {
    // Save test connection
    await ConnectionManager.saveConnection({
      platform: 'test_platform',
      accountId: 'test_account_123',
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
      status: 'active',
    });

    // Retrieve connection
    const connection = await ConnectionManager.getConnection('test_platform');

    if (
      connection &&
      connection.accessToken === 'test_access_token' &&
      connection.refreshToken === 'test_refresh_token'
    ) {
      console.log('   ✅ ConnectionManager save/retrieve working');

      // Clean up
      await ConnectionManager.removeConnection('test_platform');
      return true;
    } else {
      console.error('   ❌ Retrieved connection does not match saved');
      return false;
    }
  } catch (error) {
    console.error('   ❌ ConnectionManager test failed:', error);
    return false;
  }
}

// Test 4: SyncScheduler - Log Sync
async function testSyncScheduler() {
  console.log('4️⃣  Testing SyncScheduler...');
  try {
    // Create a test connection first
    await ConnectionManager.saveConnection({
      platform: 'test_sync_platform',
      accessToken: 'test_token',
      status: 'active',
    });

    // Log a sync
    await SyncScheduler.logSync('test_sync_platform', 'test', 'success', 10);

    // Get sync history
    const history = await SyncScheduler.getSyncHistory('test_sync_platform', 1);

    if (history.length > 0 && history[0].status === 'success') {
      console.log('   ✅ SyncScheduler logging working');

      // Clean up
      await ConnectionManager.removeConnection('test_sync_platform');
      return true;
    } else {
      console.error('   ❌ Sync log not found or incorrect');
      return false;
    }
  } catch (error) {
    console.error('   ❌ SyncScheduler test failed:', error);
    return false;
  }
}

// Test 5: Prisma Models
async function testPrismaModels() {
  console.log('5️⃣  Testing Prisma models...');
  try {
    // Test Contact model
    const contact = await prisma.contact.create({
      data: {
        type: 'LEAD',
        firstName: 'Test',
        lastName: 'User',
        email: `test_${Date.now()}@example.com`,
        phone: '555-0123',
      },
    });

    if (contact.id) {
      console.log('   ✅ Contact model working');

      // Clean up
      await prisma.contact.delete({ where: { id: contact.id } });
    }

    // Test Content model
    const content = await prisma.content.create({
      data: {
        platform: 'instagram',
        title: 'Test Post',
        contentType: 'post',
        status: 'draft',
      },
    });

    if (content.id) {
      console.log('   ✅ Content model working');

      // Clean up
      await prisma.content.delete({ where: { id: content.id } });
    }

    return true;
  } catch (error) {
    console.error('   ❌ Prisma models test failed:', error);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    database: await testDatabaseConnection(),
    encryption: testTokenEncryption(),
    connectionManager: await testConnectionManager(),
    syncScheduler: await testSyncScheduler(),
    prismaModels: await testPrismaModels(),
  };

  console.log('\n📊 Test Results:');
  console.log(`   Database Connection: ${results.database ? '✅' : '❌'}`);
  console.log(`   Token Encryption: ${results.encryption ? '✅' : '❌'}`);
  console.log(`   ConnectionManager: ${results.connectionManager ? '✅' : '❌'}`);
  console.log(`   SyncScheduler: ${results.syncScheduler ? '✅' : '❌'}`);
  console.log(`   Prisma Models: ${results.prismaModels ? '✅' : '❌'}`);

  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    console.log('\n✅ All tests passed! Foundation is solid.\n');
  } else {
    console.log('\n❌ Some tests failed. Review errors above.\n');
    process.exit(1);
  }

  await prisma.$disconnect();
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});
