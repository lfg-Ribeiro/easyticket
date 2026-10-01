import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOrganizer: boolean;
  isAdmin: boolean;
  isValidator: boolean;
  rolesLoaded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, cpf?: string, phone?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isValidator, setIsValidator] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const recoveryHandled = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === "PASSWORD_RECOVERY" && !recoveryHandled.current) {
          recoveryHandled.current = true;
          window.location.replace("/update-password");
          return;
        }

        if (session?.user) {
          setTimeout(() => {
            checkOrganizerRole(session.user.id);
          }, 0);
        } else {
          setIsOrganizer(false);
          setIsAdmin(false);
          setIsValidator(false);
          setRolesLoaded(true);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkOrganizerRole(session.user.id);
      } else {
        setRolesLoaded(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkOrganizerRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as string);
    setIsOrganizer(roles.includes("organizer"));
    setIsAdmin(roles.includes("admin"));
    setIsValidator(roles.includes("validator"));
    setRolesLoaded(true);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, cpf?: string, phone?: string) => {
    const redirectUrl = "https://www.easyticket.dev.br/";
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName, cpf: cpf || '', phone: phone || '' },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsOrganizer(false);
    setIsAdmin(false);
    setIsValidator(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isOrganizer, isAdmin, isValidator, rolesLoaded, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
