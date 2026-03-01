export type Database = {
  public: {
    Tables: {
      tokens: {
        Row: {
          id: string;
          device_id: string;
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
          device_id: string;
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
          device_id?: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
