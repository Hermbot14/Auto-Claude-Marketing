/**
 * Tenant Admin Panel Component
 *
 * Admin interface for managing all tenants in the system.
 * Provides CRUD operations, branding management, and limit configuration.
 */

import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { tenantStore, Tenant, TierType } from '../../stores/tenantStore';

// Types
interface TenantFormData {
  tenant_id: string;
  name: string;
  display_name?: string;
  tier: TierType;
}

const TenantAdmin: React.FC = observer(() => {
  const { t } = useTranslation(['admin', 'common']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Load tenants on mount
  useEffect(() => {
    tenantStore.loadTenants().catch(console.error);
  }, []);

  // Filter tenants
  const filteredTenants = tenantStore.tenants.filter(tenant => {
    const matchesSearch =
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tenant.tenant_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Get status badge color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'trial':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'suspended':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending_verification':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Get tier badge color
  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'professional':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'starter':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // Handle tenant selection
  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowEditModal(true);
  };

  // Handle create tenant
  const handleCreateTenant = async (data: TenantFormData) => {
    try {
      await tenantStore.createTenant({
        ...data,
        status: 'trial',
        branding: {
          company_name: data.name,
          primary_color: '#3b82f6',
          secondary_color: '#8b5cf6',
          hide_powered_by: false,
        },
        limits: {
          max_users: data.tier === 'free' ? 1 : 5,
          max_specs: data.tier === 'free' ? 5 : 25,
          max_agents: data.tier === 'free' ? 3 : 10,
          max_storage_mb: data.tier === 'free' ? 500 : 5000,
          api_calls_per_minute: data.tier === 'free' ? 30 : 100,
          concurrent_sessions: data.tier === 'free' ? 1 : 3,
          enable_team_features: data.tier !== 'free',
          enable_custom_branding: data.tier === 'professional' || data.tier === 'enterprise',
          enable_sso: data.tier === 'enterprise',
          enable_priority_queue: data.tier === 'professional' || data.tier === 'enterprise',
        },
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create tenant:', error);
    }
  };

  // Handle delete tenant
  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm(t('admin:confirmDeleteTenant', { defaultValue: 'Are you sure you want to delete this tenant?' }))) {
      return;
    }

    try {
      await tenantStore.deleteTenant(tenantId);
    } catch (error) {
      console.error('Failed to delete tenant:', error);
    }
  };

  return (
    <div className="tenant-admin">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('admin:tenantManagement', { defaultValue: 'Tenant Management' })}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('admin:manageAllTenants', { defaultValue: 'Manage all organizations and their configurations' })}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('admin:createTenant', { defaultValue: 'Create Tenant' })}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder={t('admin:searchTenants', { defaultValue: 'Search tenants...' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">{t('admin:allStatuses', { defaultValue: 'All Statuses' })}</option>
          <option value="active">{t('admin:statusActive', { defaultValue: 'Active' })}</option>
          <option value="trial">{t('admin:statusTrial', { defaultValue: 'Trial' })}</option>
          <option value="suspended">{t('admin:statusSuspended', { defaultValue: 'Suspended' })}</option>
        </select>
      </div>

      {/* Loading State */}
      {tenantStore.loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {tenantStore.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">{tenantStore.error}</p>
        </div>
      )}

      {/* Tenants Table */}
      {!tenantStore.loading && filteredTenants.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin:tenant', { defaultValue: 'Tenant' })}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin:status', { defaultValue: 'Status' })}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin:tier', { defaultValue: 'Tier' })}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin:created', { defaultValue: 'Created' })}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('admin:actions', { defaultValue: 'Actions' })}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {tenant.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {tenant.tenant_id}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(tenant.status)}`}>
                      {t(`admin:status${tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}`, { defaultValue: tenant.status })}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTierColor(tenant.tier)}`}>
                      {t(`admin:tier${tenant.tier.charAt(0).toUpperCase() + tenant.tier.slice(1)}`, { defaultValue: tenant.tier })}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleSelectTenant(tenant)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                    >
                      {t('common:edit', { defaultValue: 'Edit' })}
                    </button>
                    <button
                      onClick={() => handleDeleteTenant(tenant.tenant_id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      {t('common:delete', { defaultValue: 'Delete' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!tenantStore.loading && filteredTenants.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m8-2a2 2 0 100-4 2 2 0 000 4z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {t('admin:noTenants', { defaultValue: 'No tenants found' })}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('admin:getStartedByCreating', { defaultValue: 'Get started by creating a new tenant.' })}
          </p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTenant}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedTenant && (
        <EditTenantModal
          tenant={selectedTenant}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTenant(null);
          }}
        />
      )}
    </div>
  );
});

// Create Tenant Modal Component
interface CreateTenantModalProps {
  onClose: () => void;
  onSubmit: (data: TenantFormData) => void;
}

const CreateTenantModal: React.FC<CreateTenantModalProps> = ({ onClose, onSubmit }) => {
  const { t } = useTranslation(['admin', 'common']);
  const [formData, setFormData] = useState<TenantFormData>({
    tenant_id: '',
    name: '',
    tier: 'free',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('admin:createNewTenant', { defaultValue: 'Create New Tenant' })}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin:tenantId', { defaultValue: 'Tenant ID' })}
            </label>
            <input
              type="text"
              required
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="my-company"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('admin:tenantIdHint', { defaultValue: 'Unique identifier for the tenant (lowercase, hyphens only)' })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin:companyName', { defaultValue: 'Company Name' })}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="My Company"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin:subscriptionTier', { defaultValue: 'Subscription Tier' })}
            </label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value as TierType })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="free">{t('admin:tierFree', { defaultValue: 'Free' })}</option>
              <option value="starter">{t('admin:tierStarter', { defaultValue: 'Starter' })}</option>
              <option value="professional">{t('admin:tierProfessional', { defaultValue: 'Professional' })}</option>
              <option value="enterprise">{t('admin:tierEnterprise', { defaultValue: 'Enterprise' })}</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('common:create', { defaultValue: 'Create' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Tenant Modal Component
interface EditTenantModalProps {
  tenant: Tenant;
  onClose: () => void;
}

const EditTenantModal: React.FC<EditTenantModalProps> = ({ tenant, onClose }) => {
  const { t } = useTranslation(['admin', 'common']);
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'limits'>('general');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save would be handled here
      onClose();
    } catch (error) {
      console.error('Failed to save tenant:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {tenant.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tenant.tenant_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 px-6 py-3 text-sm font-medium ${
              activeTab === 'general'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('admin:general', { defaultValue: 'General' })}
          </button>
          <button
            onClick={() => setActiveTab('branding')}
            className={`flex-1 px-6 py-3 text-sm font-medium ${
              activeTab === 'branding'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('admin:branding', { defaultValue: 'Branding' })}
          </button>
          <button
            onClick={() => setActiveTab('limits')}
            className={`flex-1 px-6 py-3 text-sm font-medium ${
              activeTab === 'limits'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('admin:limits', { defaultValue: 'Limits' })}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:status', { defaultValue: 'Status' })}
                </label>
                <select
                  value={tenant.status}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="active">{t('admin:statusActive', { defaultValue: 'Active' })}</option>
                  <option value="trial">{t('admin:statusTrial', { defaultValue: 'Trial' })}</option>
                  <option value="suspended">{t('admin:statusSuspended', { defaultValue: 'Suspended' })}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:subscriptionTier', { defaultValue: 'Subscription Tier' })}
                </label>
                <select
                  value={tenant.tier}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  <option value="free">{t('admin:tierFree', { defaultValue: 'Free' })}</option>
                  <option value="starter">{t('admin:tierStarter', { defaultValue: 'Starter' })}</option>
                  <option value="professional">{t('admin:tierProfessional', { defaultValue: 'Professional' })}</option>
                  <option value="enterprise">{t('admin:tierEnterprise', { defaultValue: 'Enterprise' })}</option>
                </select>
              </div>

              {tenant.is_trial && tenant.trial_days_remaining !== undefined && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {t('admin:trialEndsIn', { defaultValue: 'Trial ends in' })} {tenant.trial_days_remaining} {t('admin:days', { defaultValue: 'days' })}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:companyName', { defaultValue: 'Company Name' })}
                </label>
                <input
                  type="text"
                  defaultValue={tenant.branding.company_name}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:primaryColor', { defaultValue: 'Primary Color' })}
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    defaultValue={tenant.branding.primary_color}
                    className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded"
                  />
                  <input
                    type="text"
                    defaultValue={tenant.branding.primary_color}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:secondaryColor', { defaultValue: 'Secondary Color' })}
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    defaultValue={tenant.branding.secondary_color}
                    className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded"
                  />
                  <input
                    type="text"
                    defaultValue={tenant.branding.secondary_color}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:logoUrl', { defaultValue: 'Logo URL' })}
                </label>
                <input
                  type="url"
                  defaultValue={tenant.branding.logo_url || ''}
                  placeholder="https://example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('admin:customDomain', { defaultValue: 'Custom Domain' })}
                </label>
                <input
                  type="text"
                  defaultValue={tenant.branding.custom_domain || ''}
                  placeholder="app.yourcompany.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hide-powered-by"
                  defaultChecked={tenant.branding.hide_powered_by}
                  disabled={!tenant.limits.enable_custom_branding}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="hide-powered-by" className="text-sm text-gray-700 dark:text-gray-300">
                  {t('admin:hidePoweredBy', { defaultValue: 'Hide "Powered by" branding' })}
                </label>
                {!tenant.limits.enable_custom_branding && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({t('admin:requiresUpgrade', { defaultValue: 'Requires Professional tier' })})
                  </span>
                )}
              </div>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin:maxUsers', { defaultValue: 'Max Users' })}
                  </label>
                  <input
                    type="number"
                    defaultValue={tenant.limits.max_users}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin:maxSpecs', { defaultValue: 'Max Specs' })}
                  </label>
                  <input
                    type="number"
                    defaultValue={tenant.limits.max_specs}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin:maxAgents', { defaultValue: 'Max Agents' })}
                  </label>
                  <input
                    type="number"
                    defaultValue={tenant.limits.max_agents}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin:maxStorage', { defaultValue: 'Max Storage (MB)' })}
                  </label>
                  <input
                    type="number"
                    defaultValue={tenant.limits.max_storage_mb}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin:apiCallsPerMinute', { defaultValue: 'API Calls/Min' })}
                  </label>
                  <input
                    type="number"
                    defaultValue={tenant.limits.api_calls_per_minute}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('admin:concurrentSessions', { defaultValue: 'Concurrent Sessions' })}
                  </label>
                  <input
                    type="number"
                    defaultValue={tenant.limits.concurrent_sessions}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('admin:featureFlags', { defaultValue: 'Feature Flags' })}
                </h3>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked={tenant.limits.enable_team_features} className="rounded border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('admin:enableTeamFeatures', { defaultValue: 'Enable Team Features' })}
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked={tenant.limits.enable_custom_branding} className="rounded border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('admin:enableCustomBranding', { defaultValue: 'Enable Custom Branding' })}
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked={tenant.limits.enable_sso} className="rounded border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('admin:enableSSO', { defaultValue: 'Enable SSO' })}
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked={tenant.limits.enable_priority_queue} className="rounded border-gray-300 dark:border-gray-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('admin:enablePriorityQueue', { defaultValue: 'Enable Priority Queue' })}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {t('common:cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t('common:saving', { defaultValue: 'Saving...' }) : t('common:save', { defaultValue: 'Save Changes' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TenantAdmin;
