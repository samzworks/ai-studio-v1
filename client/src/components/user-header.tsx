import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, CircleUserRound as User, TimerReset as History } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { NotificationBell } from "@/components/notification-bell";

export default function UserHeader() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const typedUser = user as any; // Type conversion for user data from auth

  const getUserInitials = () => {
    if (typedUser?.firstName && typedUser?.lastName) {
      return `${typedUser.firstName[0]}${typedUser.lastName[0]}`.toUpperCase();
    }
    if (typedUser?.email) {
      return typedUser.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = () => {
    if (typedUser?.firstName && typedUser?.lastName) {
      return `${typedUser.firstName} ${typedUser.lastName}`;
    }
    if (typedUser?.firstName) {
      return typedUser.firstName;
    }
    if (typedUser?.email) {
      return typedUser.email;
    }
    return "User";
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center space-x-3">
          {t('common.siteName')}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarImage src={typedUser?.profileImageUrl || undefined} alt={getDisplayName()} />
              <AvatarFallback>{getUserInitials()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end">
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium">{getDisplayName()}</p>
              {typedUser?.email && (
                <p className="w-[200px] truncate text-sm text-muted-foreground">
                  {typedUser.email}
                </p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLocation('/history')} data-testid="menu-item-history">
            <History className="mr-2 h-4 w-4" />
            <span>{t('navigation.history')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.location.href = '/api/logout'} data-testid="menu-item-logout">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('navigation.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div >
  );
}