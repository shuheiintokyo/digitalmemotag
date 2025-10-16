const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiClient {
  constructor() {
    this.baseUrl = API_URL;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_token', token);
    }
  }

  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('admin_token');
    }
    return null;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token || this.getToken()) {
      headers['Authorization'] = `Bearer ${this.token || this.getToken()}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth
  async login(password) {
    const data = await this.request('/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (data.success) {
      this.setToken(data.token);
    }
    return data;
  }

  // Items
  async getItems() {
    return await this.request('/items');
  }

  async getItem(itemId) {
    return await this.request(`/items/${itemId}`);
  }

  async createItem(item) {
    return await this.request('/items', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateItemStatus(itemId, status) {
    return await this.request(`/items/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteItem(itemId) {
    return await this.request(`/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  // Messages
  async getMessages(itemId = null) {
    const params = itemId ? `?item_id=${itemId}` : '';
    return await this.request(`/messages${params}`);
  }

  async createMessage(message) {
    return await this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(message),
    });
  }

  // Subscriptions
  async getSubscriptions(itemId) {
    return await this.request(`/subscriptions/${itemId}`);
  }

  async createSubscription(subscription) {
    return await this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  }

  async deleteSubscription(itemId, email) {
    return await this.request(`/subscriptions/${itemId}/${email}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck() {
    return await this.request('/health');
  }
}

export const api = new ApiClient();