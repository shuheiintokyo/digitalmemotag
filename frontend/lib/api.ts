import axios from 'axios';

// Use the custom domain instead of Vercel subdomain
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.memotag.digital';

console.log('🌐 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token && token.trim() !== '') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ Error Response:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// Updated interfaces
export interface Item {
  id?: number;
  item_id: string;
  name: string;
  location: string;
  status: string;
  user_email?: string;
  total_pieces?: number;
  target_date?: string;
  progress?: number; // 0-100
  created_at?: string;
}

export interface Message {
  id?: number;
  item_id: string;
  message: string;
  user_name: string;
  msg_type: string;
  created_at?: string;
  formatted_time?: string;
}

export interface MessageCreate {
  item_id: string;
  message: string;
  user_name: string;
  msg_type: string;
  send_notification?: boolean;
}

export interface ItemCreate {
  item_id: string;
  name: string;
  location: string;
  status: string;
  user_email?: string;
  total_pieces?: number;
  target_date?: string;
  progress?: number;
}

// Auth API
export const login = async (password: string) => {
  const response = await api.post('/login', { password });
  return response.data;
};

// Items API
export const getItems = async (): Promise<Item[]> => {
  const response = await api.get('/items');
  return response.data;
};

export const getItem = async (itemId: string): Promise<Item> => {
  const response = await api.get(`/items/${itemId}`);
  return response.data;
};

export const createItem = async (item: ItemCreate) => {
  const response = await api.post('/items', item);
  return response.data;
};

export const updateItemStatus = async (itemId: string, status: string) => {
  const response = await api.patch(`/items/${itemId}/status`, { status });
  return response.data;
};

export const updateItemProgress = async (itemId: string, progress: number) => {
  try {
    // Use the items endpoint with update_progress parameter
    const response = await api.get(`/items?update_progress=${itemId},${progress}`);
    
    if (response.data.success === false) {
      throw new Error(response.data.error || 'Failed to update progress');
    }
    
    return response.data;
  } catch (error: any) {
    console.error('Progress update failed:', error);
    throw error;
  }
};

export const deleteItem = async (itemId: string) => {
  const response = await api.delete(`/items/${itemId}`);
  return response.data;
};

// Messages API
export const getMessages = async (itemId?: string): Promise<Message[]> => {
  const params = itemId ? { item_id: itemId } : {};
  const response = await api.get('/messages', { params });
  return response.data;
};

export const createMessage = async (message: MessageCreate) => {
  const response = await api.post('/messages', message);
  return response.data;
};

export const deleteMessage = async (messageId: string) => {
  const response = await api.delete(`/messages/${messageId}`);
  return response.data;
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;