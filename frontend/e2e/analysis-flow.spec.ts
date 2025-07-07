import { test, expect } from '@playwright/test';

/**
 * Analysis Flow E2E Tests
 * 
 * Tests the complete analysis creation and execution workflow.
 * This includes file upload, configuration, execution, and results viewing.
 */

test.describe('Analysis Execution Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Go to the application
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Skip tests if authentication is required
    if (page.url().includes('auth') || page.url().includes('login')) {
      test.skip();
    }
  });

  test('should navigate to new analysis page', async ({ page }) => {
    // Navigate to new analysis page directly
    await page.goto('/analysis/new');
    await page.waitForLoadState('networkidle');
    
    // Should see the new analysis form
    const hasAnalysisForm = await page.locator('form').isVisible();
    const hasFileUpload = await page.locator('text=ファイルをドラッグ&ドロップ').isVisible();
    
    console.log('Analysis form visible:', hasAnalysisForm);
    console.log('File upload area visible:', hasFileUpload);
    
    expect(hasAnalysisForm || hasFileUpload).toBe(true);
  });

  test('should display analysis type options', async ({ page }) => {
    await page.goto('/analysis/new');
    await page.waitForLoadState('networkidle');
    
    // Check for analysis type options
    const analysisTypes = [
      'CloudFormation',
      'Terraform', 
      'CDK',
      'ライブAWSアカウントスキャン'
    ];
    
    for (const type of analysisTypes) {
      const typeOption = await page.locator(`text=${type}`).isVisible();
      console.log(`${type} option visible:`, typeOption);
    }
    
    // Should see at least one analysis type
    const hasOptions = await page.locator('input[type="radio"]').count() > 0;
    expect(hasOptions).toBe(true);
  });

  test('should show project selection', async ({ page }) => {
    await page.goto('/analysis/new');
    await page.waitForLoadState('networkidle');
    
    // Look for project selection dropdown
    const hasProjectSelect = await page.locator('select').isVisible() || 
                            await page.locator('.ant-select').isVisible();
    
    console.log('Project selection visible:', hasProjectSelect);
    
    // Should have some way to select projects
    expect(hasProjectSelect).toBe(true);
  });

  test('should handle file upload area', async ({ page }) => {
    await page.goto('/analysis/new');
    await page.waitForLoadState('networkidle');
    
    // Look for file upload component
    const uploadArea = page.locator('.ant-upload-drag');
    const hasUploadArea = await uploadArea.isVisible();
    
    console.log('File upload area visible:', hasUploadArea);
    
    if (hasUploadArea) {
      // Try to interact with upload area
      await uploadArea.hover();
      
      // Should see upload instructions
      const hasInstructions = await page.locator('text=ファイルをドラッグ').isVisible() ||
                              await page.locator('text=クリックしてアップロード').isVisible();
      
      console.log('Upload instructions visible:', hasInstructions);
      expect(hasInstructions).toBe(true);
    }
  });

  test('should navigate to analysis results from dashboard', async ({ page }) => {
    // Start from dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for analysis results section on dashboard
    const hasAnalysisSection = await page.locator('text=最新の分析結果').isVisible() ||
                               await page.locator('text=分析結果').isVisible();
    
    console.log('Analysis section on dashboard visible:', hasAnalysisSection);
    
    if (hasAnalysisSection) {
      // Try to find a "view all" or similar link
      const viewAllLink = page.locator('text=すべて表示').first();
      
      if (await viewAllLink.isVisible()) {
        await viewAllLink.click();
        await page.waitForLoadState('networkidle');
        
        // Should be on analysis list page
        expect(page.url()).toContain('/analysis');
        
        // Should see analysis list content
        const hasAnalysisList = await page.locator('text=分析結果').isVisible();
        console.log('Analysis list page loaded:', hasAnalysisList);
        expect(hasAnalysisList).toBe(true);
      }
    }
  });

  test('should show analysis results list', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    
    // Should see analysis results page
    const hasAnalysisTitle = await page.locator('text=分析結果').isVisible();
    const hasAnalysisTable = await page.locator('table').isVisible() ||
                            await page.locator('.ant-table').isVisible();
    const hasNewAnalysisButton = await page.locator('text=新しい分析').isVisible();
    
    console.log('Analysis title visible:', hasAnalysisTitle);
    console.log('Analysis table visible:', hasAnalysisTable);
    console.log('New analysis button visible:', hasNewAnalysisButton);
    
    // Should see the main components of analysis list
    expect(hasAnalysisTitle || hasNewAnalysisButton).toBe(true);
  });

  test('should handle analysis detail navigation', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    
    // Look for any analysis detail links or buttons
    const detailButtons = await page.locator('text=詳細').count();
    const analysisLinks = await page.locator('a[href*="/analysis/"]').count();
    
    console.log('Detail buttons found:', detailButtons);
    console.log('Analysis links found:', analysisLinks);
    
    if (detailButtons > 0) {
      // Click the first detail button
      await page.locator('text=詳細').first().click();
      await page.waitForLoadState('networkidle');
      
      // Should be on analysis detail page
      expect(page.url()).toMatch(/\/analysis\/[^\/]+$/);
      
      // Should see analysis detail content
      const hasAnalysisContent = await page.locator('text=分析').isVisible() ||
                                 await page.locator('text=スコア').isVisible();
      console.log('Analysis detail content visible:', hasAnalysisContent);
    } else {
      console.log('No analysis details available - may need test data');
    }
  });

  test('should show proper error handling for missing analysis', async ({ page }) => {
    // Go to a non-existent analysis ID
    await page.goto('/analysis/non-existent-id');
    await page.waitForLoadState('networkidle');
    
    // Should show error message or loading state
    const hasErrorMessage = await page.locator('text=見つかりません').isVisible() ||
                           await page.locator('text=エラー').isVisible() ||
                           await page.locator('text=読み込んでいます').isVisible();
    
    console.log('Error handling visible:', hasErrorMessage);
    
    // Should handle invalid analysis IDs gracefully
    expect(hasErrorMessage).toBe(true);
  });
});