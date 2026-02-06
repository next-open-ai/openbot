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

// Skills API
export const skillsAPI = {
    getSkills: () => apiClient.get('/skills'),
    getSkill: (name) => apiClient.get(`/skills/${name}`),
    getSkillContent: (name) => apiClient.get(`/skills/${name}/content`),
};

// Config API
export const configAPI = {
    getConfig: () => apiClient.get('/config'),
    updateConfig: (updates) => apiClient.put('/config', updates),
    getProviders: () => apiClient.get('/config/providers'),
    getModels: (provider) => apiClient.get(`/config/providers/${provider}/models`),
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
