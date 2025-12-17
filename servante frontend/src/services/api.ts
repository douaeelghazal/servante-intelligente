import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  badgeScan: async (badgeId: string) => {
    const response = await api.post('/auth/badge-scan', { badgeId });
    if (response.data.success) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  adminLogin: async (password: string) => {
    const response = await api.post('/auth/admin-login', { password });
    if (response.data.success) {
      localStorage.setItem('token', response.data.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};

// ============================================
// USERS API (CRUD)
// ============================================
export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  
  create: async (userData: {
    fullName: string;
    email: string;
    badgeId: string;
    role: string;
    password?: string;
  }) => {
    const response = await api.post('/users', userData);
    return response.data;
  },
  
  update: async (id: string, userData: {
    fullName?: string;
    email?: string;
    badgeId?: string;
    role?: string;
  }) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }
};

// ============================================
// TOOLS API (CRUD COMPLET)
// ============================================
export const toolsAPI = {
  getAll: async () => {
    const response = await api.get('/tools');
    return response.data;
  },

  getAvailable: async () => {
    const response = await api.get('/tools/available');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/tools/${id}`);
    return response.data;
  },

  create: async (toolData: {
    name: string;
    category: string;
    imageUrl?: string;
    totalQuantity: number;
    size?: string;
    drawer?: string;
  }) => {
    const response = await api.post('/tools', toolData);
    return response.data;
  },

  update: async (id: string, toolData: {
    name?: string;
    category?: string;
    imageUrl?: string;
    totalQuantity?: number;
    size?: string;
    drawer?: string;
  }) => {
    const response = await api.put(`/tools/${id}`, toolData);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/tools/${id}`);
    return response.data;
  },
};

// ============================================
// BORROWS API (COMPLET)
// ============================================
export const borrowsAPI = {
  // Emprunter un outil
  borrow: async (userId: string, toolId: string, quantity: number = 1) => {
    const response = await api.post('/borrows', { userId, toolId, quantity });
    return response.data;
  },

  // Retourner un outil
  return: async (borrowId: string) => {
    const response = await api.post(`/borrows/${borrowId}/return`);
    return response.data;
  },

  // Marquer comme retourné (ADMIN)
  markAsReturned: async (borrowId: string) => {
    const response = await api.post(`/borrows/${borrowId}/mark-returned`);
    return response.data;
  },

  // Emprunts d'un utilisateur
  getUserBorrows: async (userId: string) => {
    const response = await api.get(`/borrows/user/${userId}`);
    return response.data;
  },

  // Tous les emprunts actifs
  getActive: async () => {
    const response = await api.get('/borrows/active');
    return response.data;
  },

  // Historique complet
  getHistory: async () => {
    const response = await api.get('/borrows/history');
    return response.data;
  },

  // Récupérer TOUS les emprunts (admin)
  getAll: async () => {
    const response = await api.get('/borrows');
    return response.data;
  }
};

// ============================================
// UPLOAD API
// ============================================
export const uploadAPI = {
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await axios.post(
      `${API_URL}/upload/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }
};

export default api;