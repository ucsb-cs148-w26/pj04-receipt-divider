import { apiFetch, apiUpload } from './api';

// ─── Response types (all camelCase, mirroring backend schemas) ───────────────

export interface CreateGroupResponse {
  groupId: string;
}

export interface CreateInviteLinkResponse {
  url: string;
}

export interface ProfileWithColor {
  profileId: string;
  accentColor: string;
}

export interface GetProfilesResponse {
  profiles: ProfileWithColor[];
}

export interface CreateGuestProfileResponse {
  accessToken: string;
}

export interface LoginAsResponse {
  accessToken: string;
}

export interface AddReceiptResponse {
  receiptId: string;
}

// ─── Group endpoints ──────────────────────────────────────────────────────────

/** POST /group/create — create a new group (host must be a registered user) */
export async function createGroup(
  groupName: string,
): Promise<CreateGroupResponse> {
  return apiFetch<CreateGroupResponse>('/group/create', {
    method: 'POST',
    body: JSON.stringify({ groupName }),
  });
}

/** GET /group/create-invite?group_id=… — generate an invite URL for a group */
export async function createInviteLink(
  groupId: string,
): Promise<CreateInviteLinkResponse> {
  return apiFetch<CreateInviteLinkResponse>(
    `/group/create-invite?group_id=${encodeURIComponent(groupId)}`,
  );
}

/** GET /group/validate-invite?group_id=… — returns 200 if invite is active */
export async function validateInvite(groupId: string): Promise<void> {
  return apiFetch<void>(
    `/group/validate-invite?group_id=${encodeURIComponent(groupId)}`,
  );
}

/** GET /group/profiles?group_id=… — get all profiles (with accent colours) in a group */
export async function getGroupProfiles(
  groupId: string,
): Promise<GetProfilesResponse> {
  return apiFetch<GetProfilesResponse>(
    `/group/profiles?group_id=${encodeURIComponent(groupId)}`,
  );
}

/** POST /group/profile-login — log in as an existing guest profile */
export async function loginAsProfile(
  groupId: string,
  profileId: string,
): Promise<LoginAsResponse> {
  return apiFetch<LoginAsResponse>('/group/profile-login', {
    method: 'POST',
    body: JSON.stringify({ groupId, profileId }),
  });
}

/** POST /group/create-profile — create a new guest profile and log in */
export async function createGuestProfile(
  groupId: string,
  username: string,
): Promise<CreateGuestProfileResponse> {
  return apiFetch<CreateGuestProfileResponse>('/group/create-profile', {
    method: 'POST',
    body: JSON.stringify({ groupId, username }),
  });
}

// ─── Receipt endpoints ────────────────────────────────────────────────────────

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * POST /group/receipt/add — upload a receipt image (multipart form).
 * @param groupId  The UUID of the group this receipt belongs to.
 * @param imageUri The local file URI of the receipt photo.
 */
export async function addReceipt(
  groupId: string,
  imageUri: string,
): Promise<AddReceiptResponse> {
  // Transcode to JPEG — ensures iOS HEIC and other formats become valid JPEG
  // bytes that Google Vision API can process.
  const jpeg = await manipulateAsync(imageUri, [], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });

  const formData = new FormData();
  formData.append('group_id', groupId);
  formData.append('file', {
    uri: jpeg.uri,
    name: `receipt_${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob);
  return apiUpload<AddReceiptResponse>('/group/receipt/add', formData);
}

/** DELETE /group/receipt — remove a receipt from a group */
export async function deleteReceipt(receiptId: string): Promise<void> {
  return apiFetch<void>('/group/receipt', {
    method: 'DELETE',
    body: JSON.stringify({ receiptId }),
  });
}

// ─── Item claim endpoints ─────────────────────────────────────────────────────

/** POST /group/item/claim — claim an item for the authenticated profile */
export async function claimItem(itemId: string): Promise<void> {
  return apiFetch<void>('/group/item/claim', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  });
}

/** POST /group/item/unclaim — unclaim a previously claimed item */
export async function unclaimItem(itemId: string): Promise<void> {
  return apiFetch<void>('/group/item/unclaim', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  });
}

/** POST /group/item/assign — host assigns an item to a specific guest profile */
export async function assignItem(
  itemId: string,
  guestProfileId: string,
): Promise<void> {
  return apiFetch<void>('/group/item/assign', {
    method: 'POST',
    body: JSON.stringify({ itemId, guestProfileId }),
  });
}

/** POST /group/item/unassign — host removes an item assignment from a guest */
export async function unassignItem(
  itemId: string,
  guestProfileId: string,
): Promise<void> {
  return apiFetch<void>('/group/item/unassign', {
    method: 'POST',
    body: JSON.stringify({ itemId, guestProfileId }),
  });
}
