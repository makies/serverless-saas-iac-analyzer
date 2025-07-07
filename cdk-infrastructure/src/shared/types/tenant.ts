/**
 * Tenant Type Definitions
 */

export interface Tenant {
  id: string; // Primary Key (UUID)
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  settings: TenantSettings;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  contactEmail: string;
  companyInfo?: CompanyInfo;
  subscription?: SubscriptionInfo;
}

export interface TenantSettings {
  defaultTimeZone: string;
  defaultLanguage: string;
  allowedDomains?: string[];
  quotaLimits: QuotaLimits;
  enabledFeatures: string[];
}

export interface QuotaLimits {
  maxProjects: number;
  maxUsers: number;
  maxAnalysesPerMonth: number;
  maxFileSize: number; // in MB
  retentionDays: number;
}

export interface CompanyInfo {
  companyName: string;
  industry?: string;
  size?: 'STARTUP' | 'SMB' | 'ENTERPRISE';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
  };
}

export interface SubscriptionInfo {
  planId: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  startDate: string;
  endDate?: string;
  autoRenewal: boolean;
  paymentMethod?: string;
}

export interface GetTenantArgs {
  tenantId: string;
}

export interface ListTenantsArgs {
  status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  limit?: number;
  nextToken?: string;
}

export interface CreateTenantArgs {
  name: string;
  contactEmail: string;
  tier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  settings?: Partial<TenantSettings>;
  companyInfo?: CompanyInfo;
}

export interface UpdateTenantArgs {
  tenantId: string;
  name?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  tier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
  settings?: Partial<TenantSettings>;
  contactEmail?: string;
  companyInfo?: CompanyInfo;
}