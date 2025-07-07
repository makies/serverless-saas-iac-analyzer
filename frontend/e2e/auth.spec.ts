import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * 
 * Tests the authentication flow and basic application loading.
 */

test.describe('Authentication Flow', () => {
  
  test('should load application and show authentication', async ({ page }) => {
    // Go to the starting URL
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    expect(title).toContain('Cloud Best Practice Analyzer');
    
    // Check if we can see the authentication UI or dashboard
    const isAuthPage = page.url().includes('auth') || page.url().includes('login');
    const hasGoogleSignIn = await page.locator('text=Google').isVisible();
    const hasDashboard = await page.locator('text=ダッシュボード').isVisible();
    
    console.log('Auth page detected:', isAuthPage);
    console.log('Google sign-in visible:', hasGoogleSignIn);
    console.log('Dashboard visible:', hasDashboard);
    
    // The application should either show authentication or dashboard
    const isApplicationWorking = hasGoogleSignIn || hasDashboard;
    expect(isApplicationWorking).toBe(true);
  });

  test('should show header with application name', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for the application header
    const headerText = await page.locator('h1').first().textContent();
    console.log('Header text:', headerText);
    
    expect(headerText).toContain('Cloud Best Practice Analyzer');
  });

  test('should show authentication description', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for the description text
    const hasDescription = await page.locator('text=AWS インフラストラクチャのベストプラクティス分析').isVisible();
    console.log('Application description visible:', hasDescription);
    
    expect(hasDescription).toBe(true);
  });
});