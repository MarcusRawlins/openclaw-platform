#!/usr/bin/env node
/**
 * AnselAI Phase 1 Foundation Test Script
 * Verifies all components are working
 */

import { prisma } from '@/lib/prisma';
import { ConnectionManager } from '@/lib/integrations/connection-manager';
import { SyncScheduler } from '@/lib/integrations/sync-scheduler';
import { encryptToken, decryptToken } from '@/lib/security/encrypt';

async function runTests() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  AnselAI Phase 1 Foundation Tests       ║');
  console.log('╚════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Database Connection
  console.log('Test 1: Database Connection');
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PASS: Database connected\n');
    passed++;
  } catch (error) {
    console.error('❌ FAIL: Database connection failed\n', error);
    failed++;
  }

  // Test 2: Prisma Models
  console.log('Test 2: Prisma Models');
  try {
    const userCount = await prisma.user.count();
    const contactCount = await prisma.contact.count();
    console.log(`✅ PASS: Can query models (${userCount} users, ${contactCount} contacts)\n`);
    passed++;
  } catch (error) {
    console.error('❌ FAIL: Prisma model query failed\n', error);
    failed++;
  }

  // Test 3: Token Encryption
  console.log('Test 3: Token Encryption');
  try {
    const testToken = 'test-access-token-12345';
    const encrypted = encryptToken(testToken);
    const decrypted = decryptToken(encrypted);

    if (decrypted === testToken) {
      console.log('✅ PASS: Token encryption/decryption working\n');
      passed++;
    } else {
      console.error('❌ FAIL: Decrypted token does not match original\n');
      failed++;
    }
  } catch (error) {
    console.error('❌ FAIL: Token encryption failed\n', error);
    failed++;
  }

  // Test 4: Connection Manager - Save
  console.log('Test 4: Connection Manager - Save');
  try {
    await ConnectionManager.saveConnection({
      platform: 'test-platform',
      accountId: 'test-account-123',
      accessToken: 'test-token-abc',
      refreshToken: 'test-refresh-xyz',
      status: 'active',
    });
    console.log('✅ PASS: Connection saved successfully\n');
    passed++;
  } catch (error) {
    console.error('❌ FAIL: Connection save failed\n', error);
    failed++;
  }

  // Test 5: Connection Manager - Retrieve
  console.log('Test 5: Connection Manager - Retrieve');
  try {
    const conn = await ConnectionManager.getConnection('test-platform');

    if (conn && conn.platform === 'test-platform') {
      console.log('✅ PASS: Connection retrieved successfully\n');
      passed++;
    } else {
      console.error('❌ FAIL: Retrieved connection does not match\n');
      failed++;
    }
  } catch (error) {
    console.error('❌ FAIL: Connection retrieval failed\n', error);
    failed++;
  }

  // Test 6: Connection Manager - Test Connection
  console.log('Test 6: Connection Manager - Test Connection');
  try {
    const isValid = await ConnectionManager.testConnection('test-platform');

    if (isValid) {
      console.log('✅ PASS: Connection validation working\n');
      passed++;
    } else {
      console.error('❌ FAIL: Connection validation returned false\n');
      failed++;
    }
  } catch (error) {
    console.error('❌ FAIL: Connection test failed\n', error);
    failed++;
  }

  // Test 7: Sync Scheduler - Log Sync
  console.log('Test 7: Sync Scheduler - Log Sync');
  try {
    await SyncScheduler.logSync(
      'test-platform',
      'test',
      'success',
      10,
      undefined,
      150
    );
    console.log('✅ PASS: Sync logged successfully\n');
    passed++;
  } catch (error) {
    console.error('❌ FAIL: Sync logging failed\n', error);
    failed++;
  }

  // Test 8: Sync Scheduler - Get History
  console.log('Test 8: Sync Scheduler - Get History');
  try {
    const history = await SyncScheduler.getSyncHistory('test-platform', 5);

    if (Array.isArray(history)) {
      console.log(`✅ PASS: Retrieved sync history (${history.length} entries)\n`);
      passed++;
    } else {
      console.error('❌ FAIL: Sync history is not an array\n');
      failed++;
    }
  } catch (error) {
    console.error('❌ FAIL: Sync history retrieval failed\n', error);
    failed++;
  }

  // Test 9: Sync Scheduler - Get Status
  console.log('Test 9: Sync Scheduler - Get Status');
  try {
    const status = await SyncScheduler.getSyncStatus();

    if (Array.isArray(status)) {
      console.log(
        `✅ PASS: Retrieved sync status for ${status.length} platforms\n`
      );
      passed++;
    } else {
      console.error('❌ FAIL: Sync status is not an array\n');
      failed++;
    }
  } catch (error) {
    console.error('❌ FAIL: Sync status retrieval failed\n', error);
    failed++;
  }

  // Test 10: Connection Manager - Get All
  console.log('Test 10: Connection Manager - Get All');
  try {
    const all = await ConnectionManager.getAllConnections();

    if (Array.isArray(all)) {
      console.log(`✅ PASS: Retrieved all connections (${all.length} total)\n`);
      passed++;
    } else {
      console.error('❌ FAIL: Get all connections failed\n');
      failed++;
    }
  } catch (error) {
    console.error('❌ FAIL: Get all connections failed\n', error);
    failed++;
  }

  // Cleanup
  console.log('Test 11: Connection Manager - Remove');
  try {
    await ConnectionManager.removeConnection('test-platform');
    console.log('✅ PASS: Connection removed successfully\n');
    passed++;
  } catch (error) {
    console.error('❌ FAIL: Connection removal failed\n', error);
    failed++;
  }

  // Summary
  console.log('╔════════════════════════════════════════╗');
  console.log('║           TEST SUMMARY                 ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}\n`);

  if (failed === 0) {
    console.log(
      '🎉 All tests passed! Foundation is ready for Phase 2.\n'
    );
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Review errors above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
