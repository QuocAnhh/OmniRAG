import { apiClient } from './client';

export interface BotTemplate {
    id: string;
    name: string;
    domain: 'education' | 'sales' | 'legal' | 'other';
    description: string;
    icon: string;
    system_prompt: string;
    welcome_message: string;
    fallback_message: string;
    temperature: number;
    max_tokens: number;
    personality: string;
    tone_formality: number;
    verbosity: string;
    features: Record<string, any>;
    suggested_categories: string[];
    sample_queries: string[];
    required_metadata_fields: string[];
}

export interface CreateBotFromTemplateRequest {
    template_id: string;
    name: string;
    description?: string;
    customize_config?: Record<string, any>;
}

export const botTemplatesApi = {
    // Get all templates
    async list(): Promise<BotTemplate[]> {
        const response = await apiClient.get('/api/v1/bot-templates/');
        return response.data;
    },

    // Get templates by domain
    async listByDomain(domain: 'education' | 'sales' | 'legal'): Promise<BotTemplate[]> {
        const response = await apiClient.get(`/api/v1/bot-templates/domains/${domain}`);
        return response.data;
    },

    // Get single template
    async get(templateId: string): Promise<BotTemplate> {
        const response = await apiClient.get(`/api/v1/bot-templates/${templateId}`);
        return response.data;
    },

    // Create bot from template
    async createFromTemplate(data: CreateBotFromTemplateRequest): Promise<any> {
        const response = await apiClient.post('/api/v1/bot-templates/create-from-template', data);
        return response.data;
    },
};
