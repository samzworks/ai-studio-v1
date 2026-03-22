import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Save, RotateCcw, Languages, RefreshCw } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import i18n from '@/lib/i18n';

interface Translation {
  id: number;
  key: string;
  namespace: string;
  english: string;
  arabic: string;
  lastModifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function TranslationManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editedTranslations, setEditedTranslations] = useState<{[key: string]: string}>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  // Fetch translations from backend
  const { data: translations = [], isLoading, refetch } = useQuery<Translation[]>({
    queryKey: ['/api/translations'],
    queryFn: async () => {
      const response = await fetch('/api/translations');
      if (!response.ok) throw new Error('Failed to fetch translations');
      return response.json();
    }
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { key: string; arabic: string; namespace?: string }[]) => {
      const response = await fetch('/api/translations/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ translations: updates }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update translations');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: t('toasts.success'),
        description: data.message || t('toasts.updated'),
      });
      setEditedTranslations({});
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      refetch();
    },
    onError: () => {
      toast({
        title: t('toasts.error'),
        description: t('toasts.couldNotSaveChanges'),
        variant: "destructive",
      });
    }
  });

  // Filter translations based on search
  const filteredTranslations = translations.filter(translation => 
    translation.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    translation.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
    translation.arabic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleArabicChange = (key: string, value: string) => {
    setEditedTranslations(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    const updates = Object.entries(editedTranslations).map(([key, arabic]) => ({
      key,
      arabic,
      namespace: 'common'
    }));
    
    bulkUpdateMutation.mutate(updates);
  };

  const handleResetChanges = () => {
    setEditedTranslations({});
    setHasChanges(false);
    
    toast({
      title: t('toasts.info'),
      description: "All unsaved changes have been discarded.",
    });
  };

  const handleLanguageChange = (language: string) => {
    setCurrentLanguage(language);
    i18n.changeLanguage(language);
    
    // Refresh the page to apply the new language
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const getDisplayValue = (translation: Translation, key: string) => {
    if (editedTranslations[key] !== undefined) {
      return editedTranslations[key];
    }
    return translation.arabic;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 animate-spin text-white" />
            <span className="text-white">{t('common.loading')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Languages className="w-8 h-8" />
            {t('pages.admin.translations')}
          </h1>
          <p className="text-gray-400 mt-2">
            Manage Arabic translations for your website content. All changes are saved to the database and applied across the entire application.
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Select value={currentLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('common.english')}</SelectItem>
              <SelectItem value="ar">{t('common.arabic')}</SelectItem>
            </SelectContent>
          </Select>

          {hasChanges && (
            <Button 
              variant="outline" 
              onClick={handleResetChanges}
              className="flex items-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('common.reset')}</span>
            </Button>
          )}
          
          <Button 
            onClick={handleSaveChanges}
            disabled={!hasChanges || bulkUpdateMutation.isPending}
            className="flex items-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>
              {bulkUpdateMutation.isPending 
                ? t('common.save') + '...' 
                : `${t('common.save')} (${Object.keys(editedTranslations).length})`}
            </span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Translation Entries</CardTitle>
              <CardDescription>
                Edit Arabic translations directly and save them to the database. Changes will be applied immediately after saving.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="border rounded-lg max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-1/4">Key</TableHead>
                  <TableHead className="w-3/8">English</TableHead>
                  <TableHead className="w-3/8">Arabic (Editable)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTranslations.map((translation) => (
                  <TableRow key={translation.id}>
                    <TableCell className="font-mono text-sm text-gray-400">
                      {translation.key}
                    </TableCell>
                    <TableCell className="text-sm">
                      {translation.english}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={getDisplayValue(translation, translation.key)}
                        onChange={(e) => handleArabicChange(translation.key, e.target.value)}
                        className="text-right"
                        dir="rtl"
                        placeholder="Enter Arabic translation..."
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="mt-4 text-sm text-gray-500">
            Showing {filteredTranslations.length} of {translations.length} translation entries
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Translation Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Best Practices</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Keep translations concise and clear</li>
                <li>Maintain consistency in terminology</li>
                <li>Consider right-to-left (RTL) text direction</li>
                <li>Test translations in context</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Important Notes</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>All changes are saved to the database</li>
                <li>Translations are applied site-wide</li>
                <li>Use the language switcher to preview changes</li>
                <li>Backup important translations before major changes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}