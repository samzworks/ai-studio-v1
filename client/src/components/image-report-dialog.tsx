import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Flag, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

interface Image {
  id: number;
  ownerId: string;
  prompt: string;
  url: string;
}

interface ImageReportDialogProps {
  image: Image | null;
  isOpen: boolean;
  onClose: () => void;
}

const reportSchema = z.object({
  reason: z.string().min(1, "Please select a reason for reporting"),
  description: z.string().optional(),
});

type ReportFormData = z.infer<typeof reportSchema>;

const reportReasons = [
  { value: "inappropriate_content", label: "Inappropriate Content" },
  { value: "violence", label: "Violence or Harmful Content" },
  { value: "nudity", label: "Nudity or Sexual Content" },
  { value: "hate_speech", label: "Hate Speech or Discrimination" },
  { value: "spam", label: "Spam or Misleading" },
  { value: "copyright", label: "Copyright Violation" },
  { value: "other", label: "Other" },
];

export default function ImageReportDialog({ image, isOpen, onClose }: ImageReportDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reason: "",
      description: "",
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: ReportFormData) => {
      return await apiRequest("/api/images/report", "POST", {
        imageId: image!.id,
        reason: data.reason,
        description: data.description,
      });
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: t('toasts.reportSubmitted'),
        description: t('toasts.reportSubmittedDescription'),
      });
      setTimeout(() => {
        handleClose();
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: t('toasts.errorSubmittingReport'),
        description: error.message || t('toasts.errorSubmittingReportDescription'),
        variant: "error-outline" as any,
      });
    },
  });

  const onSubmit = (data: ReportFormData) => {
    reportMutation.mutate(data);
  };

  const handleClose = () => {
    setIsSubmitted(false);
    form.reset();
    onClose();
  };

  if (!image) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-orange-500" />
            Report Image
          </DialogTitle>
          <DialogDescription>
            Help us maintain a safe community by reporting inappropriate content.
          </DialogDescription>
        </DialogHeader>

        {isSubmitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Report Submitted</h3>
            <p className="text-muted-foreground">
              Thank you for helping keep our community safe. We'll review this report and take appropriate action.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-3">
                <div className="bg-muted p-3 rounded">
                  <p className="text-sm text-muted-foreground mb-2">Reporting image:</p>
                  <div className="flex gap-3">
                    <img
                      src={image.url}
                      alt="Reported content"
                      className="w-16 h-16 object-cover rounded border"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {image.prompt}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Image ID: {image.id}
                      </p>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for reporting *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="space-y-2"
                        >
                          {reportReasons.map((reason) => (
                            <div key={reason.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={reason.value} id={reason.value} />
                              <label
                                htmlFor={reason.value}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {reason.label}
                              </label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional details (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Provide any additional context that might help us understand the issue..."
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={reportMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}