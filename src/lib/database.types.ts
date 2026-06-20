// Hand-authored minimal Supabase `Database` type matching supabase/migrations/0001_init.sql.
// Keeps the generated-client typed without pulling in the supabase CLI codegen.
// If the schema changes, update both this file and the migration.

export type Database = {
  public: {
    Tables: {
      genres: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      shows: {
        Row: {
          id: string
          slug: string
          title: string
          cover_image: string
          banner_image: string | null
          synopsis: string
          sub_episodes: number
          dub_episodes: number
          status: string
          year: number | null
          popularity_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          slug: string
          title: string
          cover_image: string
          banner_image?: string | null
          synopsis?: string
          sub_episodes?: number
          dub_episodes?: number
          status?: string
          year?: number | null
          popularity_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          cover_image?: string
          banner_image?: string | null
          synopsis?: string
          sub_episodes?: number
          dub_episodes?: number
          status?: string
          year?: number | null
          popularity_score?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      show_genres: {
        Row: {
          show_id: string
          genre_id: string
        }
        Insert: {
          show_id: string
          genre_id: string
        }
        Update: {
          show_id?: string
          genre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'show_genres_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'show_genres_genre_id_fkey'
            columns: ['genre_id']
            referencedRelation: 'genres'
            referencedColumns: ['id']
          },
        ]
      }
      episodes: {
        Row: {
          id: string
          show_id: string
          number: number
          title: string
          is_subbed: boolean
          is_dubbed: boolean
          air_date: string | null
          video_url: string | null
        }
        Insert: {
          id: string
          show_id: string
          number: number
          title?: string
          is_subbed?: boolean
          is_dubbed?: boolean
          air_date?: string | null
          video_url?: string | null
        }
        Update: {
          id?: string
          show_id?: string
          number?: number
          title?: string
          is_subbed?: boolean
          is_dubbed?: boolean
          air_date?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'episodes_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
        ]
      }
      airing_slots: {
        Row: {
          id: string
          show_id: string
          day_of_week: number
          air_time: string
          timezone: string
          season: string
        }
        Insert: {
          id: string
          show_id: string
          day_of_week: number
          air_time: string
          timezone?: string
          season?: string
        }
        Update: {
          id?: string
          show_id?: string
          day_of_week?: number
          air_time?: string
          timezone?: string
          season?: string
        }
        Relationships: [
          {
            foreignKeyName: 'airing_slots_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      comments: {
        Row: {
          id: string
          show_id: string
          user_id: string
          parent_id: string | null
          body: string
          is_edited: boolean
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          show_id: string
          user_id: string
          parent_id?: string | null
          body: string
          is_edited?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          show_id?: string
          user_id?: string
          parent_id?: string | null
          body?: string
          is_edited?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'comments_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'comments_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'comments'
            referencedColumns: ['id']
          },
        ]
      }
      forum_categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string
          sort_order: number
        }
        Insert: {
          id: string
          name: string
          slug: string
          description?: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string
          sort_order?: number
        }
        Relationships: []
      }
      forum_threads: {
        Row: {
          id: string
          category_id: string
          user_id: string
          title: string
          slug: string
          is_pinned: boolean
          is_locked: boolean
          show_id: string | null
          created_at: string
          last_activity_at: string
        }
        Insert: {
          id?: string
          category_id: string
          user_id: string
          title: string
          slug?: string
          is_pinned?: boolean
          is_locked?: boolean
          show_id?: string | null
          created_at?: string
          last_activity_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          user_id?: string
          title?: string
          slug?: string
          is_pinned?: boolean
          is_locked?: boolean
          show_id?: string | null
          created_at?: string
          last_activity_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'forum_threads_category_id_fkey'
            columns: ['category_id']
            referencedRelation: 'forum_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'forum_threads_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'forum_threads_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
        ]
      }
      forum_posts: {
        Row: {
          id: string
          thread_id: string
          user_id: string
          body: string
          is_edited: boolean
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          user_id: string
          body: string
          is_edited?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          user_id?: string
          body?: string
          is_edited?: boolean
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'forum_posts_thread_id_fkey'
            columns: ['thread_id']
            referencedRelation: 'forum_threads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'forum_posts_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      ad_placements: {
        Row: {
          id: string
          placement_key: string
          name: string | null
          image_url: string
          target_url: string
          alt_text: string | null
          weight: number
          is_active: boolean
          impressions: number
          clicks: number
          created_at: string
        }
        Insert: {
          id: string
          placement_key: string
          name?: string | null
          image_url: string
          target_url: string
          alt_text?: string | null
          weight?: number
          is_active?: boolean
          impressions?: number
          clicks?: number
          created_at?: string
        }
        Update: {
          id?: string
          placement_key?: string
          name?: string | null
          image_url?: string
          target_url?: string
          alt_text?: string | null
          weight?: number
          is_active?: boolean
          impressions?: number
          clicks?: number
          created_at?: string
        }
        Relationships: []
      }
      watch_progress: {
        Row: {
          user_id: string
          show_id: string
          episode_id: string
          position_seconds: number
          duration_seconds: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          show_id: string
          episode_id: string
          position_seconds?: number
          duration_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          show_id?: string
          episode_id?: string
          position_seconds?: number
          duration_seconds?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'watch_progress_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'watch_progress_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'watch_progress_episode_id_fkey'
            columns: ['episode_id']
            referencedRelation: 'episodes'
            referencedColumns: ['id']
          },
        ]
      }
      show_view_events: {
        Row: {
          id: number
          show_id: string
          user_id: string | null
          occurred_at: string
          view_hour: string
        }
        Insert: {
          id?: number
          show_id: string
          user_id?: string | null
          occurred_at?: string
          view_hour?: string
        }
        Update: {
          id?: number
          show_id?: string
          user_id?: string | null
          occurred_at?: string
          view_hour?: string
        }
        Relationships: [
          {
            foreignKeyName: 'show_view_events_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'show_view_events_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      watchlist: {
        Row: {
          user_id: string
          show_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          show_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          show_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'watchlist_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'watchlist_show_id_fkey'
            columns: ['show_id']
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      record_ad_impression: {
        Args: { p_id: string }
        Returns: undefined
      }
      record_ad_click: {
        Args: { p_id: string }
        Returns: undefined
      }
      record_watch_progress: {
        Args: {
          p_show_id: string
          p_episode_id: string
          p_position_seconds: number
          p_duration_seconds: number
        }
        Returns: undefined
      }
      add_to_watchlist: {
        Args: { p_show_id: string }
        Returns: undefined
      }
      record_show_view: {
        Args: { p_show_id: string }
        Returns: undefined
      }
      get_top_anime: {
        Args: { p_since: string; p_limit?: number }
        Returns: {
          id: string
          slug: string
          title: string
          cover_image: string
          sub_episodes: number
          dub_episodes: number
          status: string
          year: number | null
          views: number
        }[]
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
