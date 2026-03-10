/**
 * TypeScript interfaces mirroring backend ORM / DB tables.
 * Keep in sync with backend/app/models (Profile, Group, GroupMember, Item, ItemClaim, Receipt).
 * UUIDs and datetimes are strings as returned by JSON/Supabase.
 */

export interface Profile {
  id: string;
  created_at: string;
  email: string;
}

export interface Group {
  id: string;
  created_at: string;
  created_by: string;
  name: string | null;
}

export type PaidStatusDb = 'verified' | 'pending' | 'requested' | 'unrequested';

export interface GroupMember {
  profile_id: string;
  group_id: string;
  joined_at: string;
  paid_status: PaidStatusDb;
}

export interface Item {
  id: string;
  receipt_id: string | null;
  group_id: string;
  name: string;
  amount: number;
  unit_price: number;
  created_at: string;
}

export interface ItemClaim {
  item_id: string;
  profile_id: string;
  share: number;
  claimed_at: string;
}

export interface Receipt {
  id: string;
  group_id: string;
  image: string | null;
  is_manual: boolean;
  total: number;
  tax: number | null;
  created_by: string;
  created_at: string;
}
