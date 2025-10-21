import axios from 'axios';

// Update the API base URL to your deployed backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://digitalmemotag-backend.vercel.app';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests - FIXED to not send empty Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  // Only add Authorization header if token exists
  // Don't send Authorization header at all if no token (for public endpoints)
  if (token && token.trim() !== '') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

// Update item progress - Enhanced with better error handling
export const updateItemProgress = async (itemId: string, progress: number) => {
  try {
    console.log(`📤 Updating progress for ${itemId} to ${progress}%`);
    
    // Create a specific request without auth header for this public endpoint
    const response = await axios.patch(
      `${API_BASE_URL}/items/${itemId}/progress`,
      null, // No body needed as progress is in query param
      {
        params: { progress },
        headers: {
          'Content-Type': 'application/json',
        },
        // Don't include Authorization header for this public endpoint
      }
    );
    
    console.log('✅ Progress update response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('❌ Progress update failed:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
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