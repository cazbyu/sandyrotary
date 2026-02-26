import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Member } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  member: Member | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMember(session.user.email!);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMember(session.user.email!);
      } else {
        setMember(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMember = async (email: string) => {
    try {
      const { data, error } = await supabase
        .schema('p0012_rotary')
        .from('members')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching member:', error);
      } else {
        setMember(data);
      }
    } catch (error) {
      console.error('Error fetching member:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setMember(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        member,
        isAdmin: member?.is_admin ?? false,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
