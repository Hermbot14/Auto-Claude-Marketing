/**
 * Tenant Store for Auto Claude Marketing Hub
 *
 * Manages tenant state, branding, team members, and permissions.
 * Implements multi-tenant context for the frontend.
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { i18n } from '@/shared/i18n';
import { authService } from '@/shared/services/auth-service';

// Types
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'pending_verification' | 'deleted';
export type TierType = 'free' | 'starter' | 'professional' | 'enterprise';
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TenantBranding {
  company_name: string;
  logo_url?: string;
  favicon_url?: string;
  primary_color: string;
  secondary_color: string;
  custom_domain?: string;
  custom_css?: string;
  hide_powered_by: boolean;
}

export interface TenantLimits {
  max_users: number;
  max_specs: number;
  max_agents: number;
  max_storage_mb: number;
  api_calls_per_minute: number;
  concurrent_sessions: number;
  enable_team_features: boolean;
  enable_custom_branding: boolean;
  enable_sso: boolean;
  enable_priority_queue: boolean;
}

export interface Tenant {
  id: string;
  tenant_id: string;
  name: string;
  display_name?: string;
  status: TenantStatus;
  tier: TierType;
  branding: TenantBranding;
  limits: TenantLimits;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  trial_ends_at?: string;
  is_active: boolean;
  is_trial: boolean;
  trial_days_remaining?: number;
}

export interface TeamMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TeamRole;
  display_name?: string;
  email?: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
  email_verified: boolean;
  invited_at: string;
  joined_at?: string;
  last_active_at?: string;
  is_owner: boolean;
  is_admin: boolean;
}

export interface TenantInvite {
  id: string;
  tenant_id: string;
  invited_by: string;
  email: string;
  role: TeamRole;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  is_expired: boolean;
  is_pending: boolean;
}

export interface TenantUsage {
  specs_used: number;
  agents_used: number;
  storage_used_mb: number;
  api_calls_this_minute: number;
  active_sessions: number;
  users_count: number;
}

// API Response types
interface TenantsResponse {
  tenants: Tenant[];
  total: number;
}

interface TeamMembersResponse {
  members: TeamMember[];
  total: number;
}

interface InvitesResponse {
  invites: TenantInvite[];
  total: number;
}

/**
 * Tenant Store - MobX store for tenant management
 */
class TenantStore {
  // State
  tenants: Tenant[] = [];
  currentTenant: Tenant | null = null;
  teamMembers: TeamMember[] = [];
  invites: TenantInvite[] = [];
  usage: TenantUsage | null = null;

  // Loading states
  loading = false;
  loadingMembers = false;
  loadingInvites = false;
  inviting = false;

  // Error states
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Load all tenants (admin only)
   */
  async loadTenants(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch('/api/admin/tenants', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load tenants');
      }

      const data: TenantsResponse = await response.json();

      runInAction(() => {
        this.tenants = data.tenants;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to load tenants';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Load current tenant
   */
  async loadCurrentTenant(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch('/api/tenant/current', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load tenant');
      }

      const tenant: Tenant = await response.json();

      runInAction(() => {
        this.currentTenant = tenant;
        this.loading = false;
      });

      // Apply branding
      this.applyBranding(tenant.branding);
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to load tenant';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Load tenant by ID
   */
  async loadTenant(tenantId: string): Promise<Tenant> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load tenant');
      }

      const tenant: Tenant = await response.json();

      runInAction(() => {
        this.loading = false;
      });

      return tenant;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to load tenant';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Create new tenant (admin only)
   */
  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create tenant');
      }

      const tenant: Tenant = await response.json();

      runInAction(() => {
        this.tenants.push(tenant);
        this.loading = false;
      });

      return tenant;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to create tenant';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<Tenant> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update tenant');
      }

      const tenant: Tenant = await response.json();

      runInAction(() => {
        const index = this.tenants.findIndex(t => t.tenant_id === tenantId);
        if (index !== -1) {
          this.tenants[index] = tenant;
        }
        if (this.currentTenant?.tenant_id === tenantId) {
          this.currentTenant = tenant;
          this.applyBranding(tenant.branding);
        }
        this.loading = false;
      });

      return tenant;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to update tenant';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Update tenant branding
   */
  async updateBranding(tenantId: string, branding: Partial<TenantBranding>): Promise<Tenant> {
    return this.updateTenant(tenantId, { branding: branding as TenantBranding });
  }

  /**
   * Update tenant limits
   */
  async updateLimits(tenantId: string, limits: Partial<TenantLimits>): Promise<Tenant> {
    return this.updateTenant(tenantId, { limits: limits as TenantLimits });
  }

  /**
   * Delete tenant (admin only)
   */
  async deleteTenant(tenantId: string): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete tenant');
      }

      runInAction(() => {
        this.tenants = this.tenants.filter(t => t.tenant_id !== tenantId);
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to delete tenant';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Load team members for current tenant
   */
  async loadTeamMembers(): Promise<void> {
    this.loadingMembers = true;
    this.error = null;

    try {
      const response = await fetch('/api/tenant/members', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load team members');
      }

      const data: TeamMembersResponse = await response.json();

      runInAction(() => {
        this.teamMembers = data.members;
        this.loadingMembers = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to load team members';
        this.loadingMembers = false;
      });
      throw err;
    }
  }

  /**
   * Update team member role
   */
  async updateMemberRole(memberId: string, role: TeamRole): Promise<TeamMember> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/tenant/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        throw new Error('Failed to update member role');
      }

      const member: TeamMember = await response.json();

      runInAction(() => {
        const index = this.teamMembers.findIndex(m => m.id === memberId);
        if (index !== -1) {
          this.teamMembers[index] = member;
        }
        this.loading = false;
      });

      return member;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to update member role';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Remove team member
   */
  async removeMember(memberId: string): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/tenant/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      runInAction(() => {
        this.teamMembers = this.teamMembers.filter(m => m.id !== memberId);
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to remove member';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Load pending invites
   */
  async loadInvites(): Promise<void> {
    this.loadingInvites = true;
    this.error = null;

    try {
      const response = await fetch('/api/tenant/invites', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load invites');
      }

      const data: InvitesResponse = await response.json();

      runInAction(() => {
        this.invites = data.invites;
        this.loadingInvites = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to load invites';
        this.loadingInvites = false;
      });
      throw err;
    }
  }

  /**
   * Invite team member
   */
  async inviteMember(email: string, role: TeamRole): Promise<TenantInvite> {
    this.inviting = true;
    this.error = null;

    try {
      const response = await fetch('/api/tenant/invites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send invite');
      }

      const invite: TenantInvite = await response.json();

      runInAction(() => {
        this.invites.push(invite);
        this.inviting = false;
      });

      return invite;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to send invite';
        this.inviting = false;
      });
      throw err;
    }
  }

  /**
   * Cancel invite
   */
  async cancelInvite(inviteId: string): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/tenant/invites/${inviteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel invite');
      }

      runInAction(() => {
        this.invites = this.invites.filter(i => i.id !== inviteId);
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to cancel invite';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Resend invite
   */
  async resendInvite(inviteId: string): Promise<TenantInvite> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/tenant/invites/${inviteId}/resend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to resend invite');
      }

      const invite: TenantInvite = await response.json();

      runInAction(() => {
        const index = this.invites.findIndex(i => i.id === inviteId);
        if (index !== -1) {
          this.invites[index] = invite;
        }
        this.loading = false;
      });

      return invite;
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to resend invite';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Load tenant usage statistics
   */
  async loadUsage(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch('/api/tenant/usage', {
        headers: {
          'Authorization': `Bearer ${authService.getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load usage');
      }

      const usage: TenantUsage = await response.json();

      runInAction(() => {
        this.usage = usage;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err instanceof Error ? err.message : 'Failed to load usage';
        this.loading = false;
      });
      throw err;
    }
  }

  /**
   * Apply branding to the application
   */
  private applyBranding(branding: TenantBranding): void {
    // Apply CSS variables for colors
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primary_color);
    root.style.setProperty('--brand-secondary', branding.secondary_color);

    // Update favicon
    if (branding.favicon_url) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = branding.favicon_url;
      }
    }

    // Update page title
    if (branding.company_name) {
      document.title = `${branding.company_name} - Auto Claude`;
    }

    // Inject custom CSS
    if (branding.custom_css) {
      let customStyle = document.getElementById('custom-branding-css');
      if (!customStyle) {
        customStyle = document.createElement('style');
        customStyle.id = 'custom-branding-css';
        document.head.appendChild(customStyle);
      }
      customStyle.textContent = branding.custom_css;
    }
  }

  /**
   * Check if current user can perform admin action
   */
  canPerformAdminAction(): boolean {
    if (!this.currentTenant) {
      return false;
    }
    // In a real implementation, check against current user's role
    return this.currentTenant.limits.enable_team_features;
  }

  /**
   * Check if tenant can use custom branding
   */
  canUseCustomBranding(): boolean {
    return this.currentTenant?.limits.enable_custom_branding ?? false;
  }

  /**
   * Get usage percentage for a resource
   */
  getUsagePercentage(resource: keyof TenantUsage): number {
    if (!this.usage || !this.currentTenant) {
      return 0;
    }

    const limits = this.currentTenant.limits;
    const used = this.usage[resource];
    const max = limits[`max_${resource}` as keyof TenantLimits] as number;

    return max > 0 ? Math.round((used / max) * 100) : 0;
  }
}

// Create singleton instance
export const tenantStore = new TenantStore();
