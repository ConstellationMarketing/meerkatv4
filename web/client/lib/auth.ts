import { supabase } from "@/lib/supabase";
import { getUserRole } from "@/lib/team-members";

export type User = {
  id: string;
  email: string;
  role?: "admin" | "member" | null;
};

export async function signUp(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("User registration failed");
  }

  const role = await getUserRole(data.user.id);

  return {
    id: data.user.id,
    email: data.user.email || "",
    role,
  };
}

export async function signIn(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Sign in failed");
  }

  const role = await getUserRole(data.user.id);

  return {
    id: data.user.id,
    email: data.user.email || "",
    role,
  };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const role = await getUserRole(data.user.id);

  return {
    id: data.user.id,
    email: data.user.email || "",
    role,
  };
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
}

export function onAuthStateChange(
  callback: (user: User | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const role = await getUserRole(session.user.id);
      callback({
        id: session.user.id,
        email: session.user.email || "",
        role,
      });
    } else {
      callback(null);
    }
  });

  return () => {
    subscription?.unsubscribe();
  };
}
