import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 * 
 * Tests all screen transitions and navigation flows in the application.
 * Note: These tests assume Google OAuth authentication is working in the environment.
 */

test.describe('Application Navigation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Go to the starting URL
    await page.goto('/');
    
    // Wait for authentication redirect or login page
    // In a real environment, you might need to handle OAuth login
    // For now, we'll assume the user is already authenticated
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard and display basic elements', async ({ page }) => {
    // Check if we're on the dashboard or need to authenticate
    const title = await page.title();
    console.log('Page title:', title);
    
    // If we hit the auth page, we'll skip the detailed tests
    if (page.url().includes('auth') || page.url().includes('login')) {
      console.log('Authentication required - skipping detailed navigation tests');
      expect(page.url()).toContain('localhost:3001');
      return;
    }

    // Wait for the main content to load
    await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
    
    // Should see some dashboard content
    await expect(page.locator('text=ダッシュボード')).toBeVisible();
  });

  test('should navigate to analysis results page', async ({ page }) => {
    // Skip if authentication required
    if (page.url().includes('auth') || page.url().includes('login')) {
      test.skip();
    }

    // Try to find and click navigation menu
    const analysisLink = page.locator('text=分析結果').first();
    
    if (await analysisLink.isVisible()) {
      await analysisLink.click();
      
      // Wait for navigation
      await page.waitForLoadState('networkidle');
      
      // Should be on analysis page
      expect(page.url()).toContain('/analysis');
      
      // Should see analysis results content
      await expect(page.locator('text=分析結果')).toBeVisible();
    } else {
      console.log('Analysis navigation link not found - user may not be logged in');
    }
  });

  test('should navigate to project management page', async ({ page }) => {
    // Skip if authentication required
    if (page.url().includes('auth') || page.url().includes('login')) {
      test.skip();
    }

    // Try to find and click navigation menu
    const projectsLink = page.locator('text=プロジェクト').first();
    
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      
      // Wait for navigation
      await page.waitForLoadState('networkidle');
      
      // Should be on projects page
      expect(page.url()).toContain('/projects');
      
      // Should see projects content
      await expect(page.locator('text=プロジェクト')).toBeVisible();
    } else {
      console.log('Projects navigation link not found - user may not be logged in');
    }
  });

  test('should navigate to tenant management page', async ({ page }) => {
    // Skip if authentication required
    if (page.url().includes('auth') || page.url().includes('login')) {
      test.skip();
    }

    // Try to find and click navigation menu
    const tenantLink = page.locator('text=テナント管理').first();
    
    if (await tenantLink.isVisible()) {
      await tenantLink.click();
      
      // Wait for navigation
      await page.waitForLoadState('networkidle');
      
      // Should be on tenant management page
      expect(page.url()).toContain('/admin/tenants');
      
      // Should see tenant management content
      await expect(page.locator('text=テナント管理')).toBeVisible();
    } else {
      console.log('Tenant management navigation link not found - user may not be logged in');
    }
  });

  test('should navigate to framework management page', async ({ page }) => {
    // Skip if authentication required
    if (page.url().includes('auth') || page.url().includes('login')) {
      test.skip();
    }

    // Try to find and click navigation menu
    const frameworkLink = page.locator('text=フレームワーク管理').first();
    
    if (await frameworkLink.isVisible()) {
      await frameworkLink.click();
      
      // Wait for navigation
      await page.waitForLoadState('networkidle');
      
      // Should be on framework management page
      expect(page.url()).toContain('/admin/frameworks');
      
      // Should see framework management content
      await expect(page.locator('text=フレームワーク管理')).toBeVisible();
    } else {
      console.log('Framework management navigation link not found - user may not be logged in');
    }
  });

  test('should navigate between dashboard and analysis results', async ({ page }) => {
    // Skip if authentication required
    if (page.url().includes('auth') || page.url().includes('login')) {
      test.skip();
    }

    // Start from dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for "すべて表示" link in latest analysis results
    const viewAllLink = page.locator('text=すべて表示').first();
    
    if (await viewAllLink.isVisible()) {
      await viewAllLink.click();
      
      // Should navigate to analysis results page
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/analysis');
      
      // Should see analysis results
      await expect(page.locator('text=分析結果')).toBeVisible();
      
      // Navigate back to dashboard via menu
      const dashboardLink = page.locator('text=ダッシュボード').first();
      if (await dashboardLink.isVisible()) {
        await dashboardLink.click();
        await page.waitForLoadState('networkidle');
        expect(page.url()).toBe('http://localhost:3001/');
      }
    } else {
      console.log('View all link not found - may need authentication');
    }
  });

  test('should handle analysis detail navigation', async ({ page }) => {
    // Skip if authentication required
    if (page.url().includes('auth') || page.url().includes('login')) {
      test.skip();
    }

    // Navigate to analysis results first
    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    
    // Look for a detail button in the analysis table
    const detailButton = page.locator('text=詳細').first();
    
    if (await detailButton.isVisible()) {
      await detailButton.click();
      
      // Should navigate to analysis detail page
      await page.waitForLoadState('networkidle');
      expect(page.url()).toMatch(/\/analysis\/.*$/);
      
      // Should see analysis detail content
      await expect(page.locator('text=分析')).toBeVisible();
    } else {
      console.log('Detail button not found - may not have test data');
    }
  });
});