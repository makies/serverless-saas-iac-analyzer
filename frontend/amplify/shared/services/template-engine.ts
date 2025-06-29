import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { ReportTemplateData } from '../../functions/generate-report/resource';

export interface TemplateEngineConfig {
  s3Client: S3Client;
  templatesBucket: string;
  customTemplate?: string;
}

/**
 * TemplateEngine handles report template rendering
 */
export class TemplateEngine {
  constructor(private config: TemplateEngineConfig) {}

  /**
   * Render template with data
   */
  async renderTemplate(reportType: string, data: ReportTemplateData): Promise<string> {
    try {
      // Get template content
      const templateContent = await this.getTemplate(reportType);
      
      // Use handlebars for template rendering
      const Handlebars = await import('handlebars');
      
      // Register helpers
      this.registerHelpers(Handlebars);
      
      // Compile and render template
      const template = Handlebars.compile(templateContent);
      const renderedHtml = template(data);

      return renderedHtml;
    } catch (error) {
      console.error('Error rendering template:', error);
      throw error;
    }
  }

  private async getTemplate(reportType: string): Promise<string> {
    try {
      // Use custom template if provided
      if (this.config.customTemplate) {
        const result = await this.config.s3Client.send(
          new GetObjectCommand({
            Bucket: this.config.templatesBucket,
            Key: this.config.customTemplate,
          })
        );
        return await result.Body!.transformToString();
      }

      // Use default template based on report type
      const templateMap: Record<string, string> = {
        'ANALYSIS_SUMMARY': process.env.ANALYSIS_SUMMARY_TEMPLATE || 'analysis-summary.html',
        'DETAILED_FINDINGS': process.env.DETAILED_FINDINGS_TEMPLATE || 'detailed-findings.html',
        'EXECUTIVE_SUMMARY': process.env.EXECUTIVE_SUMMARY_TEMPLATE || 'executive-summary.html',
        'COMPLIANCE_REPORT': process.env.COMPLIANCE_REPORT_TEMPLATE || 'compliance-report.html',
      };

      const templateKey = `${process.env.TEMPLATE_PREFIX || 'templates/'}${templateMap[reportType]}`;

      const result = await this.config.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.templatesBucket,
          Key: templateKey,
        })
      );

      return await result.Body!.transformToString();
    } catch (error) {
      console.error('Error getting template:', error);
      // Return default template
      return this.getDefaultTemplate(reportType);
    }
  }

  private registerHelpers(Handlebars: any): void {
    // Helper for formatting dates
    Handlebars.registerHelper('formatDate', (dateStr: string) => {
      if (!dateStr) return 'N/A';
      try {
        return new Date(dateStr).toLocaleDateString();
      } catch {
        return dateStr;
      }
    });

    // Helper for formatting severity with colors
    Handlebars.registerHelper('severityBadge', (severity: string) => {
      const colors: Record<string, string> = {
        CRITICAL: '#dc2626',
        HIGH: '#ea580c',
        MEDIUM: '#d97706',
        LOW: '#65a30d',
        INFO: '#0891b2',
      };
      const color = colors[severity] || '#6b7280';
      return new Handlebars.SafeString(
        `<span style="background-color: ${color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${severity}</span>`
      );
    });

    // Helper for formatting pillar names
    Handlebars.registerHelper('formatPillar', (pillar: string) => {
      return pillar.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    });

    // Helper for creating progress bars
    Handlebars.registerHelper('progressBar', (value: number, max: number = 100, color: string = '#3b82f6') => {
      const percentage = Math.min(100, Math.max(0, (value / max) * 100));
      return new Handlebars.SafeString(`
        <div style="width: 100%; background-color: #e5e7eb; border-radius: 4px; height: 20px;">
          <div style="width: ${percentage}%; background-color: ${color}; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px;">
            ${Math.round(percentage)}%
          </div>
        </div>
      `);
    });

    // Helper for conditional rendering
    Handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });

    // Helper for array length
    Handlebars.registerHelper('length', (array: any[]) => {
      return Array.isArray(array) ? array.length : 0;
    });
  }

  private getDefaultTemplate(reportType: string): string {
    // Return basic HTML template as fallback
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{reportInfo.title}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .finding { border-left: 4px solid #e5e7eb; padding-left: 15px; margin-bottom: 20px; }
        .finding.critical { border-left-color: #dc2626; }
        .finding.high { border-left-color: #ea580c; }
        .finding.medium { border-left-color: #d97706; }
        .finding.low { border-left-color: #65a30d; }
        .finding.info { border-left-color: #0891b2; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
        th { background-color: #f9fafb; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{reportInfo.title}}</h1>
        <p><strong>Generated:</strong> {{formatDate reportInfo.generatedAt}}</p>
        <p><strong>Project:</strong> {{project.name}} ({{tenant.name}})</p>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <table>
            <tr><td><strong>Total Resources</strong></td><td>{{summary.totalResources}}</td></tr>
            <tr><td><strong>Total Findings</strong></td><td>{{summary.totalFindings}}</td></tr>
            <tr><td><strong>Compliance Score</strong></td><td>{{summary.complianceScore}}%</td></tr>
            <tr><td><strong>Risk Level</strong></td><td>{{summary.riskLevel}}</td></tr>
        </table>
    </div>

    <div class="section">
        <h2>Findings by Severity</h2>
        <table>
            {{#each summary.findingsBySeverity}}
            <tr><td>{{@key}}</td><td>{{this}}</td></tr>
            {{/each}}
        </table>
    </div>

    <div class="section">
        <h2>Detailed Findings</h2>
        {{#each findings}}
        <div class="finding {{severity}}">
            <h3>{{title}} {{{severityBadge severity}}}</h3>
            <p><strong>Resource:</strong> {{resource}} | <strong>Pillar:</strong> {{formatPillar pillar}}</p>
            <p>{{description}}</p>
            <p><strong>Recommendation:</strong> {{recommendation}}</p>
        </div>
        {{/each}}
    </div>
</body>
</html>
    `;
  }
}