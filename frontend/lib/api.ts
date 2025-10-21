import axios from 'axios';

// Update the API base URL to your deployed backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://digitalmemotag-backend.vercel.app';

console.log('🌐 API Base URL:', API_BASE_URL);

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
  
  // Debug logging
  console.log('📤 Request:', {
    url: config.url,
    method: config.method,
    headers: config.headers,
    params: config.params,
    data: config.data
  });
  
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

// CRITICAL FIX: Update item progress - Multiple approaches to ensure it works
export const updateItemProgress = async (itemId: string, progress: number) => {
  console.log('🎯 updateItemProgress called:', { itemId, progress });
  
  try {
    // Approach 1: Try with query parameter (as backend expects)
    console.log(`📊 Attempting to update progress for ${itemId} to ${progress}%`);
    console.log(`📍 Full URL: ${API_BASE_URL}/items/${itemId}/progress?progress=${progress}`);
    
    const response = await api.patch(`/items/${itemId}/progress?progress=${progress}`);
    
    console.log('✅ Progress update successful:', response.data);
    return response.data;
    
  } catch (error: any) {
    console.error('❌ Progress update failed with first approach:', error);
    
    // Approach 2: Try without auth header at all (completely public)
    try {
      console.log('🔄 Trying alternative approach without any auth...');
      
      const response = await axios({
        method: 'PATCH',
        url: `${API_BASE_URL}/items/${itemId}/progress`,
        params: { progress },
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('✅ Alternative approach successful:', response.data);
      return response.data;
      
    } catch (error2: any) {
      console.error('❌ Alternative approach also failed:', error2);
      
      // Log detailed error information
      if (error2.response) {
        console.error('Server responded with error:', {
          status: error2.response.status,
          statusText: error2.response.statusText,
          data: error2.response.data,
          headers: error2.response.headers
        });
      } else if (error2.request) {
        console.error('No response received from server:', error2.request);
      } else {
        console.error('Error setting up request:', error2.message);
      }
      
      throw error2;
    }
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
  console.log('📨 Creating message:', message);
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