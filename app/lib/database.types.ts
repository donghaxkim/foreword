export type Database = {
  public: {
    Tables: {
      chat_history: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          vibe: string | null;
          subject: string | null;
          preheader: string | null;
          body: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          vibe?: string | null;
          subject?: string | null;
          preheader?: string | null;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt?: string;
          vibe?: string | null;
          subject?: string | null;
          preheader?: string | null;
          body?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          session_token_hash: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_token_hash: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_token_hash?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tokens: {
        Row: {
          id: string;
          device_id: string | null;
          user_id: string | null;
          provider: string;
          encrypted_token: string;
          iv: string;
          auth_tag: string;
          scopes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id?: string | null;
          user_id?: string | null;
          provider: string;
          encrypted_token: string;
          iv: string;
          auth_tag: string;
          scopes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string | null;
          user_id?: string | null;
          provider?: string;
          encrypted_token?: string;
          iv?: string;
          auth_tag?: string;
          scopes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          github_repo: string | null;
          personas_json: unknown;
          selected_persona_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          github_repo?: string | null;
          personas_json?: unknown;
          selected_persona_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          github_repo?: string | null;
          personas_json?: unknown;
          selected_persona_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
