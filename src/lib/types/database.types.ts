export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      abyss_team_members: {
        Row: {
          character_id: string;
          team_id: string;
        };
        Insert: {
          character_id: string;
          team_id: string;
        };
        Update: {
          character_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "abyss_team_members_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "abyss_team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "abyss_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      abyss_teams: {
        Row: {
          created_at: string | null;
          id: string;
          team_key: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          team_key: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          team_key?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          icon: string | null;
          id: string;
          name: string;
          rarity: number | null;
        };
        Insert: {
          icon?: string | null;
          id?: string;
          name: string;
          rarity?: number | null;
        };
        Update: {
          icon?: string | null;
          id?: string;
          name?: string;
          rarity?: number | null;
        };
        Relationships: [];
      };
      stygian_team_members: {
        Row: {
          character_id: string;
          team_id: string;
        };
        Insert: {
          character_id: string;
          team_id: string;
        };
        Update: {
          character_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stygian_team_members_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stygian_team_members_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "stygian_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      stygian_team_stats: {
        Row: {
          team_id: string;
          usage_rate_bottom: number | null;
          usage_rate_middle: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          version_number: number;
        };
        Insert: {
          team_id: string;
          usage_rate_bottom?: number | null;
          usage_rate_middle?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          version_number: number;
        };
        Update: {
          team_id?: string;
          usage_rate_bottom?: number | null;
          usage_rate_middle?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "stygian_team_stats_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "stygian_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      stygian_teams: {
        Row: {
          created_at: string | null;
          id: string;
          team_key: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          team_key: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          team_key?: string;
        };
        Relationships: [];
      };
      stygian_versions: {
        Row: {
          version: string;
          version_number: number;
        };
        Insert: {
          version: string;
          version_number: number;
        };
        Update: {
          version?: string;
          version_number?: number;
        };
        Relationships: [];
      };
      team_stats: {
        Row: {
          team_id: string;
          usage_rate_bottom: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          version_number: number;
        };
        Insert: {
          team_id: string;
          usage_rate_bottom?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          version_number: number;
        };
        Update: {
          team_id?: string;
          usage_rate_bottom?: number | null;
          usage_rate_top?: number | null;
          usage_total?: number | null;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "team_stats_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "abyss_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      url_to_character_mapping: {
        Row: {
          character_name: string;
          url: string;
        };
        Insert: {
          character_name: string;
          url: string;
        };
        Update: {
          character_name?: string;
          url?: string;
        };
        Relationships: [];
      };
      versions: {
        Row: {
          version: string;
          version_number: number;
        };
        Insert: {
          version: string;
          version_number: number;
        };
        Update: {
          version?: string;
          version_number?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      top_100_abyss_teams: {
        Row: {
          members: string[] | null;
          team_key: string | null;
          usage_rate_bottom: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          version_number: number | null;
        };
        Relationships: [];
      };
      top_100_stygian_teams: {
        Row: {
          members: string[] | null;
          team_key: string | null;
          usage_rate_bottom: number | null;
          usage_rate_middle: number | null;
          usage_rate_top: number | null;
          usage_total: number | null;
          version_number: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_teams_by_character: {
        Args: { p_character_name: string; p_version_number: number };
        Returns: {
          members: string[];
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_top: number;
          usage_total: number;
          version_number: number;
        }[];
      };
      get_teams_with_characters_subset: {
        Args: { p_character_names: string[]; p_version_number: number };
        Returns: {
          members: string[];
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_top: number;
          usage_total: number;
          version_number: number;
        }[];
      };
      get_teams_with_characters_subset_stygian: {
        Args: { p_character_names: string[]; p_version_number: number };
        Returns: {
          members: string[];
          team_key: string;
          usage_rate_bottom: number;
          usage_rate_middle: number;
          usage_rate_top: number;
          usage_total: number;
          version_number: number;
        }[];
      };
      refresh_top_100_abyss_teams: { Args: never; Returns: undefined };
      upsert_abyss_team: {
        Args: {
          p_character_names: string[];
          p_team_key: string;
          p_usage_rate_bottom: number;
          p_usage_rate_top: number;
          p_usage_total: number;
          p_version_number: number;
        };
        Returns: string;
      };
      upsert_abyss_teams_batch: {
        Args: { p_teams: Json[] };
        Returns: undefined;
      };
      upsert_characters: { Args: { p_characters: Json }; Returns: undefined };
      upsert_stygian_teams_batch: {
        Args: { p_teams: Json[] };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
