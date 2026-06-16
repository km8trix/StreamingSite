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
        }
        Insert: {
          id: string
          show_id: string
          number: number
          title?: string
          is_subbed?: boolean
          is_dubbed?: boolean
          air_date?: string | null
        }
        Update: {
          id?: string
          show_id?: string
          number?: number
          title?: string
          is_subbed?: boolean
          is_dubbed?: boolean
          air_date?: string | null
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
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
