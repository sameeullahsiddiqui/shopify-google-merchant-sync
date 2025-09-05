import axios from 'axios';

class ApiService {
    constructor() {
        this.baseURL = process.env.NODE_ENV === 'production'
            ? window.location.origin
            : 'http://localhost:3001';

        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                console.log(`🔄 API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                console.error('❌ API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                console.log(`✅ API Response: ${response.config.url}`, response.data);
                return response;
            },
            (error) => {
                console.error('❌ API Response Error:', error.response?.data || error.message);
                return Promise.reject(error);
            }
        );
    }

    // Helper method to handle errors
    handleError(error) {
        const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
        throw new Error(message);
    }

    // System status and health
    async getStatus() {
        try {
            const response = await this.client.get('/api/status');
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // Configuration endpoints
    async getConfig() {
        try {
            const response = await this.client.get('/api/config');
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async saveConfig(config) {
        try {
            const response = await this.client.post('/api/config', config);
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async testConnection(shopUrl, accessToken) {
        try {
            const response = await this.client.post('/api/test-connection', {
                shopUrl,
                accessToken
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // Sync operations
    async startFullSync() {
        try {
            const response = await this.client.post('/api/sync/full');
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async startIncrementalSync() {
        try {
            const response = await this.client.post('/api/sync/incremental');
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async getSyncStatus() {
        try {
            const response = await this.client.get('/api/sync/status');
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async getExportHistory(limit = 10) {
        try {
            const response = await this.client.get(`/api/export-history?limit=${limit}`, {
                params: { limit }
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async deleteExportFile(filename) {
        try {
            const response = await this.client.delete(`/api/export-history/${filename}`, {
                params: { filename }
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }


    // Product management
    async getProducts(page = 1, limit = 50, search = '') {
        try {
            const response = await this.client.get('/api/products', {
                params: { page, limit, search }
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }


    async getProductStats() {
        try {
            const response = await this.client.get('/api/products/stats');
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // Excel generation and export
    async generateExcel(filters = {}) {
        try {
            const response = await this.client.post('/api/generate-excel', { filters });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async downloadFile(filename) {
        try {
            const response = await this.client.get(`/api/download/${filename}`, {
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            return { success: true, filename };
        } catch (error) {
            this.handleError(error);
        }
    }

    // Logs and monitoring
    async getLogs(page = 1, limit = 100) {
        try {
            const response = await this.client.get('/api/logs', {
                params: { page, limit }
            });
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // Utility methods
    formatError(error) {
        if (error.response) {
            // Server responded with error status
            return {
                message: error.response.data?.error || 'Server error occurred',
                status: error.response.status,
                details: error.response.data
            };
        } else if (error.request) {
            // Request was made but no response received
            return {
                message: 'Network error - please check your connection',
                status: 0,
                details: 'No response from server'
            };
        } else {
            // Something else happened
            return {
                message: error.message || 'An unexpected error occurred',
                status: -1,
                details: error
            };
        }
    }

    // Real-time data polling
    startPolling(endpoint, callback, interval = 5000) {
        const pollData = async () => {
            try {
                const response = await this.client.get(endpoint);
                callback(response.data, null);
            } catch (error) {
                callback(null, this.formatError(error));
            }
        };

        // Initial call
        pollData();

        // Set up interval
        const intervalId = setInterval(pollData, interval);

        // Return cleanup function
        return () => clearInterval(intervalId);
    }

    // Batch operations
    async batchRequest(requests) {
        try {
            const responses = await Promise.allSettled(
                requests.map(request => this.client(request))
            );

            return responses.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return { success: true, data: result.value.data, index };
                } else {
                    return {
                        success: false,
                        error: this.formatError(result.reason),
                        index
                    };
                }
            });
        } catch (error) {
            this.handleError(error);
        }
    }

    // File upload helper
    async uploadFile(file, endpoint = '/api/upload') {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await this.client.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const progress = (progressEvent.loaded / progressEvent.total) * 100;
                    console.log(`Upload progress: ${progress.toFixed(2)}%`);
                },
            });

            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    // Helper for creating abort controllers
    createAbortController() {
        return new AbortController();
    }

    // Method with cancellation support
    async getCancellableRequest(url, abortController) {
        try {
            const response = await this.client.get(url, {
                signal: abortController.signal
            });
            return response.data;
        } catch (error) {
            if (error.name === 'CanceledError') {
                console.log('Request was cancelled');
                return null;
            }
            this.handleError(error);
        }
    }
}

// Create singleton instance
export const apiService = new ApiService();
export default apiService;