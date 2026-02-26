import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Member } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  member: Member | null;
  isAdmin: boolean;
  isLeader: boolean;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authCompleted = useRef(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      if (!authCompleted.current && loading) {
        console.error('Auth loading timeout - forcing completion');
        setLoading(false);
        setError('Authentication took too long. Please try again.');
        supabase.auth.signOut();
        setUser(null);
        setMember(null);
        authCompleted.current = true;
      }
    }, 15000);

    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        console.error('Session error:', sessionError);
        setError('Failed to connect to authentication service.');
        setLoading(false);
        authCompleted.current = true;
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        return;
      }

      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMember(session.user.id, session.user.email!);
      } else {
        setLoading(false);
        authCompleted.current = true;
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      }
    }).catch((err) => {
      console.error('Failed to get session:', err);
      setError('Failed to connect. Please check your internet connection.');
      setLoading(false);
      authCompleted.current = true;
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchMember(session.user.id, session.user.email!);
        } else {
          setMember(null);
          setLoading(false);
          setError(null);
          authCompleted.current = true;
        }
      })();
    });

    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      subscription.unsubscribe();
    };
  }, []);

  const checkLeadershipRole = async (memberId: string) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const currentYear = month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

      const { data } = await supabase
        .schema('p0012_rotary')
        .from('leadership_roles')
        .select('id')
        .eq('member_id', memberId)
        .eq('year', currentYear)
        .limit(1);

      setIsLeader(!!data && data.length > 0);
    } catch {
      setIsLeader(false);
    }
  };

  const fetchMember = async (userId: string, userEmail: string) => {
    const queryTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), 4000)
    );

    try {
      const memberQuery = supabase
        .schema('p0012_rotary')
        .from('members')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data: member, error: memberError } = await Promise.race([
        memberQuery,
        queryTimeout
      ]) as any;

      if (memberError) {
        console.error('Error fetching member by ID:', memberError);
        throw memberError;
      }

      if (member) {
        setMember(member);
        await checkLeadershipRole(member.id);
        setError(null);
        setLoading(false);
        authCompleted.current = true;
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        return;
      }

      const emailQuery = supabase
        .schema('p0012_rotary')
        .from('members')
        .select('*')
        .eq('home_email', userEmail)
        .maybeSingle();

      const { data: memberByEmail, error: emailError } = await Promise.race([
        emailQuery,
        queryTimeout
      ]) as any;

      if (emailError) {
        console.error('Error fetching member by email:', emailError);
        throw emailError;
      }

      if (memberByEmail) {
        const { data: updated } = await supabase
          .schema('p0012_rotary')
          .from('members')
          .update({ id: userId, updated_at: new Date().toISOString() })
          .eq('home_email', userEmail)
          .select()
          .maybeSingle();

        setMember(updated);
        if (updated) await checkLeadershipRole(updated.id);
        setError(null);
        authCompleted.current = true;
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      } else {
        console.log('No member record found for user');
        setError('Your account is not registered as a club member. Please contact your administrator.');
        await supabase.auth.signOut();
        setMember(null);
        setUser(null);
        authCompleted.current = true;
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      }
    } catch (error) {
      console.error('Error fetching member:', error);
      setError('Failed to load member data. Please try logging in again.');
      await supabase.auth.signOut();
      setMember(null);
      setUser(null);
      authCompleted.current = true;
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
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
        isLeader: isLeader || (member?.is_admin ?? false),
        loading,
        error,
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
