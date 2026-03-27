const API_URL = '/api';

export const getToken = () => localStorage.getItem('rf_token');

const getHeaders = () => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

const handleResponse = async (res) => {
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('rf_token');
            localStorage.removeItem('rf_username');
            localStorage.removeItem('rf_active_workspace');
            window.location.hash = '/auth';
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'API Error');
    }
    return res.json();
};

export const ApiService = {
    // ==========================================
    // AUTHENTICATION & PROFILE
    // ==========================================
    login: async (username, password) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await handleResponse(res);
        localStorage.setItem('rf_token', data.token);
        localStorage.setItem('rf_username', data.username);
        return data;
    },
    register: async (full_name, email, username, password) => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name, email, username, password })
        });
        return handleResponse(res);
    },
    logout: () => {
        localStorage.removeItem('rf_token');
        localStorage.removeItem('rf_username');
        localStorage.removeItem('rf_active_workspace');
    },
    getProfile: async () => {
        const res = await fetch(`${API_URL}/users/profile`, { headers: getHeaders() });
        return handleResponse(res);
    },
    updateProfile: async (payload) => {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });
        return handleResponse(res);
    },
    deleteAccount: async () => {
        const res = await fetch(`${API_URL}/users/profile`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res);
    },

    // ==========================================
    // WORKSPACES
    // ==========================================
    getWorkspaces: async () => {
        const res = await fetch(`${API_URL}/workspaces`, { headers: getHeaders() });
        return handleResponse(res);
    },
    createWorkspace: async (name) => {
        const res = await fetch(`${API_URL}/workspaces`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify({ name })
        });
        return handleResponse(res);
    },
    deleteWorkspace: async (id) => {
        const res = await fetch(`${API_URL}/workspaces/${id}`, { method: 'DELETE', headers: getHeaders() });
        return handleResponse(res);
    },

    // ==========================================
    // VARIABLES
    // ==========================================
    getVariables: async (workspaceId) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/variables`, { headers: getHeaders() });
        return handleResponse(res);
    },
    saveVariable: async (workspaceId, key, value) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/variables`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify({ var_key: key, var_value: value })
        });
        return handleResponse(res);
    },
    deleteVariable: async (workspaceId, id) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/variables/${id}`, { method: 'DELETE', headers: getHeaders() });
        return handleResponse(res);
    },

    // ==========================================
    // MOCKS
    // ==========================================
    getMocks: async (workspaceId) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/mocks`, { headers: getHeaders() });
        return handleResponse(res);
    },
    saveMock: async (workspaceId, payload) => {
        const method = payload.id ? 'PUT' : 'POST';
        const url = payload.id ? `${API_URL}/workspaces/${workspaceId}/mocks/${payload.id}` : `${API_URL}/workspaces/${workspaceId}/mocks`;
        const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
        return handleResponse(res);
    },
    deleteMock: async (workspaceId, id) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/mocks/${id}`, { method: 'DELETE', headers: getHeaders() });
        return handleResponse(res);
    },

    // ==========================================
    // FOLDERS
    // ==========================================
    getFolders: async (workspaceId) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/folders`, { headers: getHeaders() });
        return handleResponse(res);
    },
    createFolder: async (workspaceId, name) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/folders`, {
            method: 'POST', headers: getHeaders(), body: JSON.stringify({ name })
        });
        return handleResponse(res);
    },
    deleteFolder: async (workspaceId, id) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/folders/${id}`, { method: 'DELETE', headers: getHeaders() });
        return handleResponse(res);
    },

    // ==========================================
    // REQUESTS
    // ==========================================
    getRequests: async (workspaceId) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/requests`, { headers: getHeaders() });
        return handleResponse(res);
    },
    saveRequest: async (workspaceId, payload) => {
        const method = payload.id ? 'PUT' : 'POST';
        const url = payload.id ? `${API_URL}/workspaces/${workspaceId}/requests/${payload.id}` : `${API_URL}/workspaces/${workspaceId}/requests`;
        const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
        return handleResponse(res);
    },
    deleteRequest: async (workspaceId, id) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/requests/${id}`, { method: 'DELETE', headers: getHeaders() });
        return handleResponse(res);
    },

    // ==========================================
    // SCENARIOS
    // ==========================================
    getScenarios: async (workspaceId) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/scenarios`, { headers: getHeaders() });
        return handleResponse(res);
    },
    saveScenario: async (workspaceId, payload) => {
        const method = payload.id ? 'PUT' : 'POST';
        const url = payload.id ? `${API_URL}/workspaces/${workspaceId}/scenarios/${payload.id}` : `${API_URL}/workspaces/${workspaceId}/scenarios`;
        const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
        return handleResponse(res);
    },
    deleteScenario: async (workspaceId, id) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/scenarios/${id}`, { method: 'DELETE', headers: getHeaders() });
        return handleResponse(res);
    },

    // ==========================================
    // PROXY (SEND API REQUEST)
    // ==========================================
    proxyRequest: async (payload) => {
        const token = getToken();
        const formData = new FormData();
        Object.keys(payload).forEach(key => {
            if (key === 'formDataEntries' && Array.isArray(payload[key])) {
                payload[key].forEach(entry => {
                    if (entry.type === 'file' && entry.file) formData.append(entry.key, entry.file);
                    else if (entry.type === 'text') formData.append(entry.key, entry.value);
                });
            } else if (key === 'urlencodedEntries') {
                formData.append(key, JSON.stringify(payload[key]));
            } else {
                formData.append(key, payload[key]);
            }
        });
        const res = await fetch(`${API_URL}/proxy`, {
            method: 'POST', headers: { 'Authorization': token ? `Bearer ${token}` : '' }, body: formData
        });
        return handleResponse(res);
    },

    // ==========================================
    // INVITATIONS & COLLABORATION
    // ==========================================
    sendInvitation: async (username, resourceType, resourceId) => {
        const res = await fetch(`${API_URL}/invitations`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ username, resourceType, resourceId }) });
        return handleResponse(res);
    },
    getInvitations: async () => {
        const res = await fetch(`${API_URL}/invitations`, { headers: getHeaders() });
        return handleResponse(res);
    },
    respondInvitation: async (id, status) => {
        const res = await fetch(`${API_URL}/invitations/${id}/respond`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ status }) });
        return handleResponse(res);
    },
    searchUsers: async (query) => {
        const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, { headers: getHeaders() });
        return handleResponse(res);
    },
    getCollaborators: async (workspaceId) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/collaborators`, { headers: getHeaders() });
        return handleResponse(res);
    },
    revokeCollaborator: async (workspaceId, userId) => {
        const res = await fetch(`${API_URL}/workspaces/${workspaceId}/collaborators/${userId}`, { method: 'DELETE', headers: getHeaders() });
        return handleResponse(res);
    },

    // ==========================================
    // LOCAL AGENT TUNNELING
    // ==========================================
    getAgentData: async () => {
        const res = await fetch(`${API_URL}/agent`, { headers: getHeaders() });
        return handleResponse(res);
    },
    regenerateAgentToken: async () => {
        const res = await fetch(`${API_URL}/agent/regenerate`, { method: 'POST', headers: getHeaders() });
        return handleResponse(res);
    }
};

