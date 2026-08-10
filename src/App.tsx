import type { User } from "@supabase/supabase-js";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { FullPageLoader } from "@/components/FullPageLoader";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { useAccountStorage } from "@/hooks/useAccountStorage";
import { useSession } from "@/hooks/useSession";
import { isSupabaseConfigured } from "@/lib/supabase";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * Decides between the login screen and the app.
 *
 * Everything below it can assume a signed-in user, which is why the storage and
 * the routes are built inside `SignedInApp` rather than here — the storage needs
 * a user id, and there isn't one until this component says there is.
 */
function AuthGate() {
  const { session, isLoading } = useSession();

  // Checked before the session, since without a client there can never be one.
  if (!isSupabaseConfigured) return <SupabaseSetupNotice />;

  // A persisted session may need its token refreshed first. Rendering the login
  // screen during that window would sign the student out on every reload.
  if (isLoading) return <FullPageLoader label="Loading your account…" />;

  if (!session) return <Auth />;

  return <SignedInApp user={session.user} />;
}

/**
 * `key`ed on the user id so a sign-out-and-in as someone else remounts the tree.
 * Storage swaps on its own, but local UI state — the selected semester — would
 * otherwise carry a previous account's choice across.
 */
function SignedInApp({ user }: { user: User }) {
  return <UserWorkspace key={user.id} user={user} />;
}

function UserWorkspace({ user }: { user: User }) {
  const storage = useAccountStorage(user.id);

  return (
    <Routes>
      <Route path="/" element={<Index storage={storage} user={user} />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthGate />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
