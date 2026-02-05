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
    sendMessage: (id, message) => apiClient.post(`/agents/sessions/${id}/message`, { message }),
    getHistory: (id) => apiClient.get(`/agents/sessions/${id}/history`),
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

export default apiClient;
