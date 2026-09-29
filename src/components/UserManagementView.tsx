import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Key,
  Edit2,
  Trash2,
  Lock,
  Mail,
  User,
  Shield,
  Search,
} from 'lucide-react';
import { AuthUser, EnterpriseRole } from '../types';
import {
  StoredUserRecord,
  getRegisteredUsersList,
  createNewUser,
  toggleUserStatus,
  resetUserPassword,
  updateUserProfile,
} from '../services/authService';

interface UserManagementViewProps {
  currentUser: AuthUser;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export function UserManagementView({ currentUser, showToast }: UserManagementViewProps) {
  const isAdmin = currentUser.role === 'ADMIN';

  const [users, setUsers] = useState<StoredUserRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StoredUserRecord | null>(null);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<EnterpriseRole>('DEVELOPER');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit user state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<EnterpriseRole>('DEVELOPER');

  const loadUsers = async () => {
    const list = await getRegisteredUsersList();
    setUsers([...list]);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-slate-900 border border-rose-800/60 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Access Denied</h2>
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Only users with the <strong className="text-indigo-400">ADMIN</strong> role can access
          the User Management directory. Your current role is{' '}
          <span className="font-mono text-amber-300 font-bold">
            {currentUser.role.replace('_', ' ')}
          </span>
          .
        </p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      showToast('All fields are required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createNewUser(newName, newEmail, newRole, newPassword);
      if (res.success) {
        showToast(`User ${newEmail} created successfully`, 'success');
        setShowAddModal(false);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('DEVELOPER');
        await loadUsers();
      } else {
        showToast(res.error || 'Failed to create user', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error creating user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: StoredUserRecord) => {
    if (user.id === currentUser.id) {
      showToast('Cannot disable your own active administrator account', 'warning');
      return;
    }
    const success = await toggleUserStatus(user.id);
    if (success) {
      const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
      showToast(`User ${user.email} status changed to ${newStatus}`, 'info');
      await loadUsers();
    }
  };

  const handleResetPassword = async (user: StoredUserRecord) => {
    const tempPassword = 'Password@123';
    const success = await resetUserPassword(user.id, tempPassword);
    if (success) {
      showToast(`Password reset for ${user.email}. Temporary password: ${tempPassword}`, 'success');
      await loadUsers();
    }
  };

  const openEditModal = (user: StoredUserRecord) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    await updateUserProfile(editingUser.id, {
      name: editName,
      email: editEmail,
      role: editRole,
    });

    showToast(`Updated profile for ${editEmail}`, 'success');
    setEditingUser(null);
    await loadUsers();
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Enterprise User Directory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Provision identities, assign RBAC roles, and regulate access privileges.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Total Users: <strong className="text-white">{users.length}</strong>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold font-mono text-[10px]">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Last Login</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredUsers.map((user) => {
                const isCurrentUser = user.id === currentUser.id;
                return (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-white flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-indigo-400 font-bold flex items-center justify-center text-xs">
                        {user.name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div>{user.name}</div>
                        {isCurrentUser && (
                          <span className="text-[10px] text-indigo-400 font-mono">(You)</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-slate-400">{user.email}</td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                            : user.role === 'DEVOPS'
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                            : user.role === 'RELEASE_MANAGER'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-400" />
                        )}
                        <span>{user.status}</span>
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                      {user.lastLogin}
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleResetPassword(user)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition-colors"
                        title="Reset Password to Default"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={isCurrentUser}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.status === 'ACTIVE'
                            ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-400'
                            : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        title={user.status === 'ACTIVE' ? 'Disable Account' : 'Enable Account'}
                      >
                        {user.status === 'ACTIVE' ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-200">
            <h3 className="text-base font-bold text-white mb-1">Create Enterprise User</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a new authenticated member to the drift validator platform.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Work Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. alex@company.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Role Assignment</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as EnterpriseRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-sans"
                >
                  <option value="DEVELOPER">DEVELOPER (Feature delivery & What-if)</option>
                  <option value="DEVOPS">DEVOPS (Operational fixes & rollbacks)</option>
                  <option value="RELEASE_MANAGER">RELEASE_MANAGER (Gatekeeper approvals)</option>
                  <option value="ADMIN">ADMIN (Full platform permissions)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Initial Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-3 font-sans">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-200">
            <h3 className="text-base font-bold text-white mb-1">Edit User Profile</h3>
            <p className="text-xs text-slate-400 mb-4">
              Update credentials and role for {editingUser.email}.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as EnterpriseRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-sans"
                >
                  <option value="DEVELOPER">DEVELOPER</option>
                  <option value="DEVOPS">DEVOPS</option>
                  <option value="RELEASE_MANAGER">RELEASE_MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-3 font-sans">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
