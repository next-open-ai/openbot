import axios from 'axios';

const API_BASE_URL = '/server-api'; // Relative path to use the same origin (Gateway proxy)

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Agent API
export const agentAPI = {
    createSession: (options) => apiClient.post('/agents/sessions', options),
    getSessions: () => apiClient.get('/agents/sessions'),
    getSession: (id) => apiClient.get(`/agents/sessions/${id}`),
    deleteSession: (id) => apiClient.delete(`/agents/sessions/${id}`),
    getHistory: (id) => apiClient.get(`/agents/sessions/${id}/history`),
    appendMessage: (id, role, content, options = {}) =>
        apiClient.post(`/agents/sessions/${id}/messages`, { role, content, ...options }),
};

// Agent config (智能体配置) API
export const agentConfigAPI = {
    listAgents: () => apiClient.get('/agent-config'),
    getAgent: (id) => apiClient.get(`/agent-config/${id}`),
    createAgent: (body) => apiClient.post('/agent-config', body),
    updateAgent: (id, body) => apiClient.put(`/agent-config/${id}`, body),
    deleteAgent: (id) => apiClient.delete(`/agent-config/${id}`),
};

// Skills API
export const skillsAPI = {
    getSkills: (workspace) =>
        apiClient.get('/skills', workspace ? { params: { workspace } } : {}),
    getSkill: (name) => apiClient.get(`/skills/${name}`),
    getSkillContent: (name, workspace) =>
        apiClient.get(`/skills/${name}/content`, workspace ? { params: { workspace } } : {}),
    addSkill: (body) => apiClient.post('/skills', body),
    deleteSkill: (workspace, name) =>
        apiClient.delete(`/skills/${encodeURIComponent(name)}`, { params: { workspace } }),
};

// Config API
export const configAPI = {
    getConfig: () => apiClient.get('/config'),
    updateConfig: (updates) => apiClient.put('/config', updates),
    getProviders: () => apiClient.get('/config/providers'),
    getModels: (provider) => apiClient.get(`/config/providers/${provider}/models`),
};

// Auth API（登录）
export const authAPI = {
    login: (username, password) => apiClient.post('/auth/login', { username, password }),
};

// Users API（用户管理）
export const usersAPI = {
    list: () => apiClient.get('/users'),
    create: (username, password) => apiClient.post('/users', { username, password }),
    update: (id, updates) => apiClient.put(`/users/${id}`, updates),
    delete: (id) => apiClient.delete(`/users/${id}`),
};

// Tasks API (定时任务)
export const tasksAPI = {
    list: () => apiClient.get('/tasks'),
    get: (id) => apiClient.get(`/tasks/${id}`),
    create: (body) => apiClient.post('/tasks', body),
    update: (id, body) => apiClient.put(`/tasks/${id}`, body),
    delete: (id) => apiClient.delete(`/tasks/${id}`),
    listExecutions: (taskId) => apiClient.get(`/tasks/${taskId}/executions`),
    getExecution: (eid) => apiClient.get(`/tasks/executions/${eid}`),
    clearExecutions: (taskId) => apiClient.delete(`/tasks/${taskId}/executions`),
};

// Workspace API
export const workspaceAPI = {
    listWorkspaces: () => apiClient.get('/workspace'),
    getCurrentWorkspace: () => apiClient.get('/workspace/current'),
    listDocuments: (workspace, path = '') =>
        apiClient.get('/workspace/documents', { params: { workspace, path } }),
    fileServeUrl: (workspace, path, download = false) => {
        const base = apiClient.defaults.baseURL || '/server-api';
        const params = new URLSearchParams({ workspace, path });
        if (download) params.set('download', '1');
        return `${base}/workspace/files/serve?${params.toString()}`;
    },
    deleteDocument: (workspace, path) =>
        apiClient.delete('/workspace/files', { params: { workspace, path } }),
};

export default apiClient;
