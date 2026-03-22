import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Plus, Edit, Trash as Trash2, TestTube, Eye, Clipboard as Copy } from "lucide-react";
import type { PromptTemplate, InsertPromptTemplate } from '@shared/schema';

interface PromptPreview {
  originalPrompt: string;
  processedPrompt: string;
  extractedVariables: string[];
  validationErrors: string[];
  template: PromptTemplate | null;
}

const PROMPT_TYPES = [
  { value: 'image_generation', label: 'Image Generation' },
  { value: 'video_generation', label: 'Video Generation' },
  { value: 'image_enhancement', label: 'Image Enhancement' },
  { value: 'video_enhancement', label: 'Video Enhancement' },
  { value: 'translation', label: 'Translation' },
  { value: 'saudi_category_classifier', label: 'Saudi Category Classifier' },
  { value: 'saudi_enhancement', label: 'Saudi Auto-Enhancement' }
];

const CATEGORIES = [
  { value: 'default', label: 'Default' },
  { value: 'model_specific', label: 'Model Specific' },
  { value: 'saudi', label: 'Saudi' },
  { value: 'custom', label: 'Custom' }
];

export default function PromptManagement() {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<PromptPreview | null>(null);
  
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Fetch all prompt templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/prompt-templates'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/prompt-templates');
      return response.json();
    },
  });

  // Initialize default prompts mutation
  const initDefaultsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/prompt-templates/init-defaults');
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({ title: t('toasts.success'), description: result.message });
    },
    onError: (error) => {
      console.error('Init defaults error:', error);
      toast({ title: t('toasts.error'), description: t('toasts.failed'), variant: 'destructive' });
    }
  });

  // Toggle template status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest('PATCH', `/api/prompt-templates/${id}/toggle`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({ title: t('toasts.success'), description: t('toasts.updated') });
    },
    onError: () => {
      toast({ title: t('toasts.error'), description: t('toasts.failed'), variant: 'destructive' });
    }
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/prompt-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
      toast({ title: t('toasts.success'), description: t('toasts.deleted') });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast({ title: t('toasts.error'), description: t('toasts.failed'), variant: 'destructive' });
    }
  });

  // Preview prompt mutation
  const previewMutation = useMutation({
    mutationFn: async ({ templateId, variables, promptText }: { templateId?: number; variables: Record<string, string>; promptText?: string }) => {
      const response = await apiRequest('POST', '/api/prompt-templates/process', { templateId, variables, promptText });
      return response.json();
    },
    onSuccess: (result: PromptPreview) => {
      setPreviewResult(result);
    },
    onError: () => {
      toast({ title: t('toasts.error'), description: t('toasts.failed'), variant: 'destructive' });
    }
  });

  const handlePreview = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setPreviewVariables({});
    setPreviewResult(null);
    setPreviewDialogOpen(true);
    
    // Auto-generate preview with empty variables
    previewMutation.mutate({ templateId: template.id, variables: {} });
  };

  const updatePreview = () => {
    if (selectedTemplate) {
      previewMutation.mutate({ templateId: selectedTemplate.id, variables: previewVariables });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('toasts.success'), description: t('toasts.promptCopied') });
  };

  const groupedTemplates = (templates as PromptTemplate[]).reduce((acc: Record<string, PromptTemplate[]>, template: PromptTemplate) => {
    if (!acc[template.type]) {
      acc[template.type] = [];
    }
    acc[template.type].push(template);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading prompt templates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Prompt Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage AI prompt templates with variable support and per-model overrides
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => initDefaultsMutation.mutate()}
            disabled={initDefaultsMutation.isPending}
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Init Defaults
          </Button>
          <Button onClick={() => {
            setSelectedTemplate(null);
            setEditDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="inline-flex h-auto min-w-full flex-wrap lg:flex-nowrap gap-1 p-1">
            <TabsTrigger value="overview" className="whitespace-nowrap px-3 py-2">Overview</TabsTrigger>
            {PROMPT_TYPES.map(type => (
              <TabsTrigger key={type.value} value={type.value} className="whitespace-nowrap px-3 py-2">
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROMPT_TYPES.map(type => {
              const typeTemplates = groupedTemplates[type.value] || [];
              const activeCount = typeTemplates.filter((t: any) => t.isActive).length;
              
              return (
                <Card key={type.value}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {type.label}
                      <Badge variant={activeCount > 0 ? 'default' : 'secondary'}>
                        {activeCount} active
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {typeTemplates.length} total templates
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {typeTemplates.slice(0, 3).map(template => (
                        <div key={template.id} className="flex items-center justify-between">
                          <span className="text-sm truncate">{template.displayName}</span>
                          <div className="flex items-center gap-1">
                            {template.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
                            {!template.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                          </div>
                        </div>
                      ))}
                      {typeTemplates.length > 3 && (
                        <div className="text-xs text-gray-500">
                          +{typeTemplates.length - 3} more
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {PROMPT_TYPES.map(type => (
          <TabsContent key={type.value} value={type.value} className="space-y-4">
            <div className="grid gap-4">
              {(groupedTemplates[type.value] || []).map((template: PromptTemplate) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {template.displayName}
                          {template.isDefault && <Badge>Default</Badge>}
                          {template.modelId && <Badge variant="outline">{template.modelId}</Badge>}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <span>{template.name}</span>
                          <span>•</span>
                          <span className="capitalize">{template.category}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={(checked) => 
                            toggleStatusMutation.mutate({ id: template.id, isActive: checked })
                          }
                          disabled={toggleStatusMutation.isPending}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(template)}
                          title="Preview template"
                        >
                          <TestTube className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setEditDialogOpen(true);
                          }}
                          title="Edit template"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(template.id)}
                          disabled={template.isDefault || deleteMutation.isPending}
                          title={template.isDefault ? "Cannot delete default template" : "Delete template"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Prompt Template:</Label>
                        <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <code className="text-sm text-gray-900 dark:text-gray-100">{template.promptText}</code>
                        </div>
                      </div>
                      {template.description && (
                        <div>
                          <Label className="text-sm font-medium">Description:</Label>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {template.description}
                          </p>
                        </div>
                      )}
                      {template.variables && typeof template.variables === 'object' && template.variables !== null && Object.keys(template.variables).length > 0 ? (
                        <div>
                          <Label className="text-sm font-medium">Variables:</Label>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.keys(template.variables as Record<string, any>).map((varName) => (
                              <Badge key={varName} variant="secondary" className="text-xs">
                                {varName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Prompt Template</DialogTitle>
            <DialogDescription>
              Test your prompt template with sample variables
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-6">
              <div>
                <Label className="font-medium">Template: {selectedTemplate.displayName}</Label>
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <code className="text-sm text-gray-900 dark:text-gray-100">{selectedTemplate.promptText}</code>
                </div>
              </div>

              {previewResult && previewResult.extractedVariables.length > 0 && (
                <div>
                  <Label className="font-medium">Variables:</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {previewResult.extractedVariables.map(varName => (
                      <div key={varName}>
                        <Label htmlFor={varName} className="text-sm">
                          {varName}
                        </Label>
                        <Input
                          id={varName}
                          value={previewVariables[varName] || ''}
                          onChange={(e) => setPreviewVariables(prev => ({
                            ...prev,
                            [varName]: e.target.value
                          }))}
                          placeholder={`Enter ${varName}...`}
                        />
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={updatePreview} 
                    className="mt-4"
                    disabled={previewMutation.isPending}
                  >
                    Update Preview
                  </Button>
                </div>
              )}

              {previewResult && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="font-medium">Final Prompt:</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(previewResult.processedPrompt)}
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="mt-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border">
                      <p className="text-sm">{previewResult.processedPrompt}</p>
                    </div>
                  </div>

                  {previewResult.validationErrors.length > 0 && (
                    <div>
                      <Label className="font-medium text-red-600">Validation Errors:</Label>
                      <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200">
                        <ul className="text-sm text-red-600 space-y-1">
                          {previewResult.validationErrors.map((error, index) => (
                            <li key={index}>• Missing required variable: {error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Edit Prompt Template' : 'Create New Prompt Template'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate ? 'Update the prompt template settings' : 'Create a new prompt template with variables and settings'}
            </DialogDescription>
          </DialogHeader>
          
          <EditTemplateForm 
            template={selectedTemplate}
            onSave={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/prompt-templates'] });
              setEditDialogOpen(false);
              setSelectedTemplate(null);
            }}
            onCancel={() => {
              setEditDialogOpen(false);
              setSelectedTemplate(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Edit Template Form Component
function EditTemplateForm({ 
  template, 
  onSave, 
  onCancel 
}: { 
  template: PromptTemplate | null; 
  onSave: () => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: template?.name || '',
    displayName: template?.displayName || '',
    type: template?.type || 'image_generation',
    promptText: template?.promptText || '',
    description: template?.description || '',
    category: template?.category || 'default',
    modelId: template?.modelId || '',
    isActive: template?.isActive ?? true,
  });

  const { toast } = useToast();
  const { t } = useTranslation();

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = template ? 'PUT' : 'POST';
      const url = template ? `/api/prompt-templates/${template.id}` : '/api/prompt-templates';
      const response = await apiRequest(method, url, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('toasts.success'), description: template ? t('toasts.updated') : t('toasts.created') });
      onSave();
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast({ title: t('toasts.error'), description: t('toasts.failed'), variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.displayName || !formData.promptText) {
      toast({ title: t('toasts.error'), description: t('forms.validation.required'), variant: 'destructive' });
      return;
    }

    saveMutation.mutate(formData);
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">System Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., image_generation_default"
            required
          />
        </div>
        <div>
          <Label htmlFor="displayName">Display Name *</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => updateField('displayName', e.target.value)}
            placeholder="e.g., Default Image Generation"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="type">Type *</Label>
          <Select value={formData.type} onValueChange={(value) => updateField('type', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROMPT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(value) => updateField('category', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="modelId">Model ID (Optional)</Label>
          <Input
            id="modelId"
            value={formData.modelId}
            onChange={(e) => updateField('modelId', e.target.value)}
            placeholder="e.g., flux-schnell"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="promptText">Prompt Template *</Label>
        <Textarea
          id="promptText"
          value={formData.promptText}
          onChange={(e) => updateField('promptText', e.target.value)}
          placeholder="Use {{variable_name}} for variables, e.g., {{user_prompt}}, {{style}}, high quality, detailed"
          rows={4}
          required
          className="text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use double curly braces for variables: {`{{user_prompt}}, {{style}}, {{resolution}}`}
        </p>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe what this template is used for..."
          rows={2}
          className="text-gray-900 dark:text-white bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => updateField('isActive', checked)}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : (template ? 'Update' : 'Create')}
        </Button>
      </div>
    </form>
  );
}