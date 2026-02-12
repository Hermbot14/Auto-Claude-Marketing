/**
 * Team Management Component
 *
 * UI for managing team members, invites, and permissions.
 * Supports role-based access control and member lifecycle management.
 */

import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { tenantStore, TeamMember, TenantInvite, TeamRole } from '../../stores/tenantStore';

const TeamManagement: React.FC = observer(() => {
  const { t } = useTranslation(['team', 'common']);
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    Promise.all([
      tenantStore.loadTeamMembers(),
      tenantStore.loadInvites(),
    ]).catch(console.error);
  }, []);

  const handleInviteMember = async (email: string, role: TeamRole) => {
    try {
      await tenantStore.inviteMember(email, role);
      setShowInviteModal(false);
    } catch (error) {
      console.error('Failed to invite member:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm(t('team:confirmRemoveMember', { defaultValue: 'Are you sure you want to remove this team member?' }))) {
      return;
    }
    try {
      await tenantStore.removeMember(memberId);
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const handleUpdateRole = async (memberId: string, role: TeamRole) => {
    try {
      await tenantStore.updateMemberRole(memberId, role);
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await tenantStore.cancelInvite(inviteId);
    } catch (error) {
      console.error('Failed to cancel invite:', error);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await tenantStore.resendInvite(inviteId);
    } catch (error) {
      console.error('Failed to resend invite:', error);
    }
  };

  const getRoleBadgeColor = (role: TeamRole): string => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'member':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="team-management">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('team:teamManagement', { defaultValue: 'Team Management' })}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('team:manageTeamMembers', { defaultValue: 'Manage team members and permissions' })}
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('team:inviteMember', { defaultValue: 'Invite Member' })}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('members')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('team:members', { defaultValue: 'Members' })}
            <span className="ml-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-0.5 px-2 rounded-full text-xs">
              {tenantStore.teamMembers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'invites'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('team:pendingInvites', { defaultValue: 'Pending Invites' })}
            <span className="ml-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 py-0.5 px-2 rounded-full text-xs">
              {tenantStore.invites.filter(i => i.is_pending).length}
            </span>
          </button>
        </nav>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {tenantStore.loadingMembers ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : tenantStore.teamMembers.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {t('team:noMembers', { defaultValue: 'No team members yet' })}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('team:getStartedByInviting', { defaultValue: 'Get started by inviting team members.' })}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
              {tenantStore.teamMembers.map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {member.display_name?.charAt(0).toUpperCase() || member.email?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.display_name || member.email || t('team:unknownUser', { defaultValue: 'Unknown User' })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {member.email || ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value as TeamRole)}
                      disabled={member.is_owner}
                      className="text-sm border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white disabled:opacity-50"
                    >
                      <option value="viewer">{t('team:roleViewer', { defaultValue: 'Viewer' })}</option>
                      <option value="member">{t('team:roleMember', { defaultValue: 'Member' })}</option>
                      <option value="admin">{t('team:roleAdmin', { defaultValue: 'Admin' })}</option>
                      <option value="owner" disabled>{t('team:roleOwner', { defaultValue: 'Owner' })}</option>
                    </select>

                    {!member.is_owner && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invites Tab */}
      {activeTab === 'invites' && (
        <div className="space-y-4">
          {tenantStore.loadingInvites ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : tenantStore.invites.filter(i => i.is_pending).length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {t('team:noPendingInvites', { defaultValue: 'No pending invites' })}
              </h3>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
              {tenantStore.invites
                .filter(i => i.is_pending)
                .map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {invite.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('team:invitedAs', { defaultValue: 'Invited as' })} {t(`team:role${invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}`, { defaultValue: invite.role })}
                          {' • '}
                          {t('team:expires', { defaultValue: 'Expires' })} {new Date(invite.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResendInvite(invite.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title={t('team:resendInvite', { defaultValue: 'Resend Invite' })}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleCancelInvite(invite.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        title={t('team:cancelInvite', { defaultValue: 'Cancel Invite' })}
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteMember}
        />
      )}
    </div>
  );
});

// Invite Modal Component
interface InviteModalProps {
  onClose: () => void;
  onInvite: (email: string, role: TeamRole) => void;
}

const InviteModal: React.FC<InviteModalProps> = ({ onClose, onInvite }) => {
  const { t } = useTranslation(['team', 'common']);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [inviting, setInviting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await onInvite(email, role);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('team:inviteTeamMember', { defaultValue: 'Invite Team Member' })}
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
              {t('team:emailAddress', { defaultValue: 'Email Address' })}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('team:role', { defaultValue: 'Role' })}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as TeamRole)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value="viewer">{t('team:roleViewer', { defaultValue: 'Viewer' })} - {t('team:viewerDesc', { defaultValue: 'Can view only' })}</option>
              <option value="member">{t('team:roleMember', { defaultValue: 'Member' })} - {t('team:memberDesc', { defaultValue: 'Can edit and create' })}</option>
              <option value="admin">{t('team:roleAdmin', { defaultValue: 'Admin' })} - {t('team:adminDesc', { defaultValue: 'Full access except billing' })}</option>
            </select>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {t('team:inviteWillReceiveEmail', { defaultValue: 'An email invitation will be sent to the address above. They will need to accept the invite to join your team.' })}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={inviting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {inviting ? t('common:sending', { defaultValue: 'Sending...' }) : t('team:sendInvite', { defaultValue: 'Send Invite' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamManagement;
