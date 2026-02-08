import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { navSections, type NavGroup, type NavLink } from './navConfig';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/use-toast';

export function MainLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = useAuthStore((s) => s.signOut);
  const toast = useToast().toast;
  const isPasswordFlow =
    location.pathname === '/force-password-change' || location.pathname === '/reset-password';

  const handleSignOut = async () => {
    setMobileNavOpen(false);
    try {
      await signOut();
      toast({ title: 'Signed out' });
    } catch (err: any) {
      toast({
        title: 'Sign out failed',
        description: err?.message ?? 'Please try again',
        variant: 'destructive',
      });
    } finally {
      if (isPasswordFlow) {
        return;
      }
      navigate('/login', { replace: true });
      if (location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  };

  const renderLink = (item: NavLink, options?: { nested?: boolean }) => {
    const isActive =
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    return (
      <Link
        key={`${item.path}-${options?.nested ? 'nested' : 'root'}`}
        to={item.path}
        onClick={() => setMobileNavOpen(false)}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm',
          options?.nested ? 'pl-8' : 'pl-3',
          isActive ? 'bg-accent text-accent-foreground font-semibold' : 'hover:bg-accent/60'
        )}
      >
        <item.icon className="w-4 h-4" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => (
    <div key={group.key} className="space-y-1">
      <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
        <div className="flex items-center gap-2">
          <group.icon className="w-4 h-4" />
          <span>{group.label}</span>
        </div>
      </div>
      <div className="space-y-1">{group.children.map((child) => renderLink(child, { nested: true }))}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b md:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold">ShopFlow</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>

      <header className="hidden md:flex items-center justify-end px-4 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </header>
      <div className="flex flex-1 overflow-hidden min-w-0">
        <Sidebar className="hidden md:flex" />
        <main className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {isMobile && (
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetHeader className="px-4 pt-4 pb-2 text-left">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="px-2 pb-4 space-y-2 overflow-y-auto flex-1">
              {navSections.map((section) => (
                <div key={section.label} className="space-y-1">
                  <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.label}
                  </div>
                  <div className="space-y-1">
                    {section.items.map((item) =>
                      item.type === 'group' ? renderGroup(item) : renderLink(item)
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
