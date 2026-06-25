import React, { useState } from 'react';
import { Code, Copy, Database, FileText, KeyRound, Plus, Settings, ShieldCheck, Terminal, Trash2, User } from 'lucide-react';
import { AuthUser, IntegrationProvider, InviteCreateResult, SettingsPayload, UserRole } from '../types';

interface SettingsTabProps {
  settings: SettingsPayload | null;
  currentUser: AuthUser | null;
  canManageUsers: boolean;
  onInviteUser: (input: { email: string; fullName: string; role: UserRole }) => Promise<InviteCreateResult>;
  onChangeUserRole: (userId: string, role: UserRole) => Promise<void>;
  onSaveIntegration: (input: {
    provider: IntegrationProvider;
    displayName: string;
    metadata: Record<string, string>;
    secrets: Record<string, string>;
  }) => Promise<void>;
  onDeleteIntegration: (integrationId: string) => Promise<void>;
}

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold font-mono uppercase ${
      active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
    }`}>
      {label || (active ? "Configured" : "Not Configured")}
    </span>
  );
}

const roleOptions: UserRole[] = ["ADMINISTRATOR", "MANAGER", "BUSINESS_ANALYST"];
const integrationProviderOptions: IntegrationProvider[] = ["github_app", "jira", "linear", "jenkins", "hosting", "temporal", "kubernetes"];

function formatTimestamp(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SettingsTab({
  settings,
  currentUser,
  canManageUsers,
  onInviteUser,
  onChangeUserRole,
  onSaveIntegration,
  onDeleteIntegration,
}: SettingsTabProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("MANAGER");
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [formError, setFormError] = useState("");
  const [integrationProvider, setIntegrationProvider] = useState<IntegrationProvider>("github_app");
  const [integrationName, setIntegrationName] = useState("");
  const [integrationMetadata, setIntegrationMetadata] = useState("");
  const [integrationSecretName, setIntegrationSecretName] = useState("token");
  const [integrationSecretValue, setIntegrationSecretValue] = useState("");

  const submitInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!inviteEmail.trim()) {
      setFormError("Email is required.");
      return;
    }

    setPendingAction("invite");
    setInviteCopied(false);
    try {
      const result = await onInviteUser({
        email: inviteEmail.trim(),
        fullName: inviteName.trim(),
        role: inviteRole,
      });
      setLastInviteUrl(result.invite.url);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("MANAGER");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invite failed.");
    } finally {
      setPendingAction("");
    }
  };

  const copyInviteUrl = async () => {
    if (!lastInviteUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(lastInviteUrl);
    setInviteCopied(true);
  };

  const changeRole = async (userId: string, role: UserRole) => {
    setFormError("");
    setPendingAction(`role:${userId}`);
    try {
      await onChangeUserRole(userId, role);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Role update failed.");
    } finally {
      setPendingAction("");
    }
  };

  const submitIntegration = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!integrationSecretName.trim() || !integrationSecretValue) {
      setFormError("Integration secret name and value are required.");
      return;
    }

    const metadata = integrationMetadata.trim()
      ? { reference: integrationMetadata.trim() }
      : {};

    setPendingAction("integration");
    try {
      await onSaveIntegration({
        provider: integrationProvider,
        displayName: integrationName.trim() || integrationProvider.replace("_", " "),
        metadata,
        secrets: {
          [integrationSecretName.trim()]: integrationSecretValue,
        },
      });
      setIntegrationName("");
      setIntegrationMetadata("");
      setIntegrationSecretName("token");
      setIntegrationSecretValue("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Integration save failed.");
    } finally {
      setPendingAction("");
    }
  };

  const deleteIntegration = async (integrationId: string) => {
    setFormError("");
    setPendingAction(`integration:${integrationId}`);
    try {
      await onDeleteIntegration(integrationId);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Integration delete failed.");
    } finally {
      setPendingAction("");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-800" />
            Platform Settings & Integrations
          </h1>
          <p className="text-sm text-[#475569] mt-2">Runtime configuration, source control OAuth, workflow providers, and user access.</p>
        </div>

        <div className="space-y-8">
          <div className="border border-[#E2E8F0] p-6 bg-[#F8FAFC]">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Code className="w-4 h-4" /> Source Code
            </h2>

            <div className="grid gap-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">GitHub OAuth</div>
                  <div className="text-xs text-[#475569]">Used for sign-in now; GitHub App installation tokens are tracked as a follow-up adapter.</div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge active={Boolean(settings?.integrations.githubOAuthConfigured)} />
                  <a
                    href="/api/auth/github"
                    className="px-4 py-2 border border-[#E2E8F0] text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  >
                    Connect GitHub
                  </a>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Gemini Agent Output Provider</div>
                  <div className="text-xs text-[#475569]">Optional Gemini key for richer agent artifact generation.</div>
                </div>
                <StatusBadge active={Boolean(settings?.integrations.geminiConfigured)} />
              </div>
            </div>
          </div>

          <div className="border border-[#E2E8F0] p-6 bg-[#F8FAFC]">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Workflow Runtime
            </h2>

            <div className="grid gap-4">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div>
                  <div className="text-sm font-bold text-slate-800">Workflow Provider</div>
                  <div className="text-xs text-[#475569]">Current runner: {settings?.runtime.workflowProvider || "loading"}</div>
                </div>
                <StatusBadge active={Boolean(settings?.integrations.temporalConfigured)} label={settings?.integrations.temporalConfigured ? "Temporal" : "Local Runner"} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Sandbox Provider</div>
                  <div className="text-xs text-[#475569]">Current runner: {settings?.runtime.sandboxProvider || "loading"}</div>
                </div>
                <StatusBadge active={Boolean(settings?.integrations.kubernetesConfigured)} label={settings?.integrations.kubernetesConfigured ? "Kubernetes" : "Local Provider"} />
              </div>
            </div>
          </div>

          <div className="border border-[#E2E8F0] p-6 bg-[#F8FAFC]">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4" /> Data Store
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">Operational Records</div>
                <div className="text-xs text-[#475569]">Current store: {settings?.runtime.dataStore || "loading"}</div>
              </div>
              <StatusBadge active={Boolean(settings?.integrations.postgresConfigured)} label={settings?.integrations.postgresConfigured ? "Postgres" : "JSON Store"} />
            </div>
          </div>

          <div className="border border-[#E2E8F0] p-6 bg-white">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Integration Secrets
            </h2>

            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
              <div>
                <div className="text-sm font-bold text-slate-800">Encrypted Provider Credentials</div>
                <div className="text-xs text-[#475569]">Stored encrypted at rest. Secret values are never returned by the API.</div>
              </div>
              <StatusBadge
                active={Boolean(settings?.integrations.secretStorageConfigured)}
                label={settings?.integrations.secretStorageConfigured ? "Custom Key" : "Dev Key"}
              />
            </div>

            {canManageUsers && (
              <form onSubmit={submitIntegration} className="grid grid-cols-1 md:grid-cols-[170px_1fr_1fr_140px_1fr_auto] gap-2 mb-4">
                <select
                  value={integrationProvider}
                  onChange={(event) => setIntegrationProvider(event.target.value as IntegrationProvider)}
                  className="px-3 py-2 border border-[#E2E8F0] text-xs font-mono bg-white focus:outline-none focus:border-black"
                >
                  {integrationProviderOptions.map((provider) => (
                    <option key={provider} value={provider}>{provider.replace("_", " ")}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={integrationName}
                  onChange={(event) => setIntegrationName(event.target.value)}
                  placeholder="Display name"
                  className="px-3 py-2 border border-[#E2E8F0] text-xs focus:outline-none focus:border-black"
                />
                <input
                  type="text"
                  value={integrationMetadata}
                  onChange={(event) => setIntegrationMetadata(event.target.value)}
                  placeholder="Reference / URL / installation"
                  className="px-3 py-2 border border-[#E2E8F0] text-xs font-mono focus:outline-none focus:border-black"
                />
                <input
                  type="text"
                  value={integrationSecretName}
                  onChange={(event) => setIntegrationSecretName(event.target.value)}
                  placeholder="Secret key"
                  className="px-3 py-2 border border-[#E2E8F0] text-xs font-mono focus:outline-none focus:border-black"
                />
                <input
                  type="password"
                  value={integrationSecretValue}
                  onChange={(event) => setIntegrationSecretValue(event.target.value)}
                  placeholder="Secret value"
                  className="px-3 py-2 border border-[#E2E8F0] text-xs font-mono focus:outline-none focus:border-black"
                />
                <button
                  type="submit"
                  disabled={pendingAction === "integration"}
                  className="px-4 py-2 bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800 disabled:bg-slate-400 flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save
                </button>
              </form>
            )}

            <div className="border border-[#E2E8F0] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] text-slate-700 uppercase font-bold">
                  <tr>
                    <th className="px-3 py-2 border-b border-[#E2E8F0]">Provider</th>
                    <th className="px-3 py-2 border-b border-[#E2E8F0]">Name</th>
                    <th className="px-3 py-2 border-b border-[#E2E8F0]">Reference</th>
                    <th className="px-3 py-2 border-b border-[#E2E8F0]">Secret Keys</th>
                    {canManageUsers && <th className="px-3 py-2 border-b border-[#E2E8F0]">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(settings?.integrationConfigs || []).map((integration) => (
                    <tr key={integration.id} className="border-t border-[#E2E8F0]">
                      <td className="px-3 py-2 font-mono uppercase">{integration.provider.replace("_", " ")}</td>
                      <td className="px-3 py-2 font-bold text-slate-800">{integration.displayName}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{integration.metadata.reference || "-"}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{integration.secretKeys.join(", ")}</td>
                      {canManageUsers && (
                        <td className="px-3 py-2">
                          <button
                            onClick={() => void deleteIntegration(integration.id)}
                            disabled={pendingAction === `integration:${integration.id}`}
                            className="px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(settings?.integrationConfigs || []).length === 0 && (
                <div className="p-4 text-sm text-slate-500 bg-[#F8FAFC]">
                  No integration secrets have been configured.
                </div>
              )}
            </div>
          </div>

          <div className="border border-[#E2E8F0] p-6 bg-white">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" /> Users & Roles
            </h2>

            {canManageUsers && (
              <>
                <form onSubmit={submitInvite} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_180px_auto] gap-2 mb-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="email@company.com"
                    className="px-3 py-2 border border-[#E2E8F0] text-xs font-mono focus:outline-none focus:border-black"
                  />
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="Full name"
                    className="px-3 py-2 border border-[#E2E8F0] text-xs focus:outline-none focus:border-black"
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as UserRole)}
                    className="px-3 py-2 border border-[#E2E8F0] text-xs font-mono bg-white focus:outline-none focus:border-black"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>{role.replace("_", " ")}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={pendingAction === "invite"}
                    className="px-4 py-2 bg-[#0F172A] text-white text-xs font-bold hover:bg-slate-800 disabled:bg-slate-400 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Invite
                  </button>
                </form>

                {lastInviteUrl && (
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                    <input
                      type="text"
                      readOnly
                      value={lastInviteUrl}
                      className="px-3 py-2 border border-emerald-200 bg-emerald-50 text-xs font-mono text-emerald-900"
                    />
                    <button
                      type="button"
                      onClick={() => void copyInviteUrl()}
                      className="px-4 py-2 border border-emerald-300 bg-white text-emerald-800 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-50"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {inviteCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </>
            )}

            {formError && (
              <div className="mb-4 border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-mono">
                {formError}
              </div>
            )}

            <table className="w-full text-left text-sm mt-4">
              <thead className="bg-[#F8FAFC] text-slate-700 text-xs uppercase font-bold">
                <tr>
                  <th className="px-3 py-2 border border-[#E2E8F0]">User Email</th>
                  <th className="px-3 py-2 border border-[#E2E8F0]">Role</th>
                  <th className="px-3 py-2 border border-[#E2E8F0]">Provider</th>
                  <th className="px-3 py-2 border border-[#E2E8F0]">Status</th>
                  {canManageUsers && <th className="px-3 py-2 border border-[#E2E8F0]">Actions</th>}
                </tr>
              </thead>
              <tbody className="text-[#475569]">
                {(settings?.users || []).map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-2 border border-[#E2E8F0]">
                      <div className="font-mono text-xs">{user.email}</div>
                      <div className="text-[10px] text-slate-400">{user.fullName}</div>
                    </td>
                    <td className="px-3 py-2 border border-[#E2E8F0]">
                      <span className="bg-[#0F172A] text-white px-2 py-0.5 text-[10px] font-bold">
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 border border-[#E2E8F0] font-mono text-xs uppercase">{user.provider}</td>
                    <td className="px-3 py-2 border border-[#E2E8F0]">
                      <span className={`flex items-center gap-1 text-xs font-bold ${
                        user.status === "INVITED" ? "text-amber-700" : "text-emerald-700"
                      }`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {currentUser?.id === user.id ? "Current Session" : user.status}
                      </span>
                    </td>
                    {canManageUsers && (
                      <td className="px-3 py-2 border border-[#E2E8F0]">
                        <select
                          value={user.role}
                          disabled={pendingAction === `role:${user.id}`}
                          onChange={(event) => void changeRole(user.id, event.target.value as UserRole)}
                          className="px-2 py-1 border border-[#E2E8F0] text-[11px] font-mono bg-white focus:outline-none focus:border-black disabled:bg-slate-100"
                        >
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>{role.replace("_", " ")}</option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {(settings?.invitations || []).length > 0 && (
              <div className="mt-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Invitation Links
                </div>
                <div className="border border-[#E2E8F0] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] text-slate-700 uppercase font-bold">
                      <tr>
                        <th className="px-3 py-2 border-b border-[#E2E8F0]">Email</th>
                        <th className="px-3 py-2 border-b border-[#E2E8F0]">Status</th>
                        <th className="px-3 py-2 border-b border-[#E2E8F0]">Created</th>
                        <th className="px-3 py-2 border-b border-[#E2E8F0]">Expires</th>
                        <th className="px-3 py-2 border-b border-[#E2E8F0]">Accepted</th>
                        <th className="px-3 py-2 border-b border-[#E2E8F0]">Delivery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(settings?.invitations || []).map((invitation) => (
                        <tr key={invitation.id} className="border-t border-[#E2E8F0]">
                          <td className="px-3 py-2 font-mono">{invitation.email}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${
                              invitation.status === "PENDING"
                                ? "bg-amber-100 text-amber-800"
                                : invitation.status === "ACCEPTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                            }`}>
                              {invitation.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-500">{formatTimestamp(invitation.createdAt)}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{formatTimestamp(invitation.expiresAt)}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{formatTimestamp(invitation.acceptedAt)}</td>
                          <td className="px-3 py-2 font-mono uppercase text-slate-500">{invitation.deliveryStatus.replace("_", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {settings?.users.length === 0 && (
              <div className="mt-4 border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-slate-500">
                No users have been created yet.
              </div>
            )}
          </div>

          <div className="border border-[#E2E8F0] p-6 bg-[#F8FAFC]">
            <h2 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" /> Pending Production Adapters
            </h2>
            <div className="grid gap-3 text-xs text-slate-600 leading-relaxed">
              <p>Jira, Linear, GitHub App installation tokens, Temporal workers, Postgres ORM, and Kubernetes sandbox execution are now explicit build-plan items instead of static UI promises.</p>
              <p>The current backend contract is designed so those adapters can replace the local providers without changing the primary React workflow.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
