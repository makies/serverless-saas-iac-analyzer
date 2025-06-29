import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface ReportStorageConfig {
  s3Client: S3Client;
  bucketName: string;
  tenantId: string;
}

export interface S3Location {
  bucket: string;
  key: string;
  region: string;
}

export interface StoreReportOptions {
  contentType: string;
  metadata?: Record<string, string>;
}

export interface SignedUrlOptions {
  expiresIn: number; // seconds
}

/**
 * ReportStorage handles S3 storage operations for reports
 */
export class ReportStorage {
  constructor(private config: ReportStorageConfig) {}

  /**
   * Store report in S3
   */
  async storeReport(
    key: string,
    buffer: Buffer,
    options: StoreReportOptions
  ): Promise<S3Location> {
    try {
      // Add tenant prefix to key for data isolation
      const tenantKey = `${this.config.tenantId}/${key}`;

      await this.config.s3Client.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key: tenantKey,
          Body: buffer,
          ContentType: options.contentType,
          Metadata: {
            ...options.metadata,
            tenantId: this.config.tenantId,
          },
          ServerSideEncryption: 'AES256',
        })
      );

      return {
        bucket: this.config.bucketName,
        key: tenantKey,
        region: process.env.AWS_REGION || 'us-east-1',
      };
    } catch (error) {
      console.error('Error storing report in S3:', error);
      throw error;
    }
  }

  /**
   * Generate signed URL for report download
   */
  async generateSignedUrl(
    key: string,
    options: SignedUrlOptions
  ): Promise<string> {
    try {
      // Ensure key has tenant prefix
      const tenantKey = key.startsWith(`${this.config.tenantId}/`) 
        ? key 
        : `${this.config.tenantId}/${key}`;

      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: tenantKey,
      });

      const signedUrl = await getSignedUrl(this.config.s3Client, command, {
        expiresIn: options.expiresIn,
      });

      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Get report metadata
   */
  async getReportMetadata(key: string): Promise<Record<string, string> | null> {
    try {
      const tenantKey = key.startsWith(`${this.config.tenantId}/`) 
        ? key 
        : `${this.config.tenantId}/${key}`;

      const result = await this.config.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: tenantKey,
        })
      );

      return result.Metadata || null;
    } catch (error) {
      console.error('Error getting report metadata:', error);
      return null;
    }
  }

  /**
   * Check if report exists
   */
  async reportExists(key: string): Promise<boolean> {
    try {
      const tenantKey = key.startsWith(`${this.config.tenantId}/`) 
        ? key 
        : `${this.config.tenantId}/${key}`;

      await this.config.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: tenantKey,
        })
      );

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get report content
   */
  async getReportContent(key: string): Promise<Buffer | null> {
    try {
      const tenantKey = key.startsWith(`${this.config.tenantId}/`) 
        ? key 
        : `${this.config.tenantId}/${key}`;

      const result = await this.config.s3Client.send(
        new GetObjectCommand({
          Bucket: this.config.bucketName,
          Key: tenantKey,
        })
      );

      if (!result.Body) {
        return null;
      }

      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      console.error('Error getting report content:', error);
      return null;
    }
  }
}