import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Send, Mailbox as Mail, CircleUserRound as User, CheckCircle, MessageCircle as MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { insertContactSubmissionSchema, type InsertContactSubmission } from "@shared/schema";

export default function Contact() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertContactSubmission>({
    resolver: zodResolver(insertContactSubmissionSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: InsertContactSubmission) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }
      
      setIsSuccess(true);
      toast({
        title: t('contact.successTitle', 'Message Sent!'),
        description: t('contact.successDescription', 'Thank you for reaching out. We\'ll get back to you soon.'),
        variant: "default"
      });
      
      form.reset();
    } catch (error) {
      console.error("Error sending contact form:", error);
      toast({
        title: t('contact.errorTitle', 'Error'),
        description: t('contact.errorDescription', 'Failed to send your message. Please try again.'),
        variant: "error-outline"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back', 'Back')}
        </Button>

        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl" data-testid="text-contact-title">{t('contact.title', 'Contact Us')}</CardTitle>
                <CardDescription className="mt-1" data-testid="text-contact-description">
                  {t('contact.description', 'Have a question or feedback? We\'d love to hear from you.')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isSuccess ? (
              <div className="text-center py-8 space-y-4" data-testid="container-success">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" data-testid="icon-success" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground" data-testid="text-thank-you-title">
                    {t('contact.thankYouTitle', 'Thank you!')}
                  </h3>
                  <p className="text-muted-foreground mt-1" data-testid="text-thank-you-message">
                    {t('contact.thankYouMessage', 'Your message has been sent successfully. We\'ll get back to you as soon as possible.')}
                  </p>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="form-contact">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {t('contact.nameLabel', 'Name')}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t('contact.namePlaceholder', 'Your name')}
                            {...field}
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {t('contact.emailLabel', 'Email')}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder={t('contact.emailPlaceholder', 'your.email@example.com')}
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          {t('contact.subjectLabel', 'Subject')}
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t('contact.subjectPlaceholder', 'What is this about?')}
                            {...field}
                            data-testid="input-subject"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          {t('contact.messageLabel', 'Message')}
                        </FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t('contact.messagePlaceholder', 'Tell us what\'s on your mind...')}
                            className="min-h-[150px] resize-none"
                            {...field}
                            data-testid="input-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={isSubmitting}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        {t('contact.sending', 'Sending...')}
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        {t('contact.sendButton', 'Send Message')}
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
