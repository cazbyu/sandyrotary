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
        fetchMember(session.user.id, session.user.email!);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchMember(session.user.id, session.user.email!);
      } else {
        setMember(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMember = async (userId: string, userEmail: string) => {
    try {
      let { data: member } = await supabase
        .from('0012-sr-members')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (member) {
        setMember(member);
        setLoading(false);
        return;
      }

      const { data: memberByEmail } = await supabase
        .from('0012-sr-members')
        .select('*')
        .eq('home_email', userEmail)
        .maybeSingle();

      if (memberByEmail) {
        const { data: updated } = await supabase
          .from('0012-sr-members')
          .update({ id: userId, updated_at: new Date().toISOString() })
          .eq('home_email', userEmail)
          .select()
          .maybeSingle();

        setMember(updated);
      } else {
        await supabase.auth.signOut();
        setMember(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching member:', error);
      await supabase.auth.signOut();
      setMember(null);
      setUser(null);
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
