import { apiFetch, apiUpload } from './api';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/** Maximum pixels allowed on either side of an image before it is resized. */
const MAX_IMAGE_DIMENSION = 2048;

// ─── Response types (all camelCase, mirroring backend schemas) ───────────────

export interface CreateGroupResponse {
  groupId: string;
}

export interface CreateInviteLinkResponse {
  url: string;
}

export interface ProfileWithColor {
  profileId: string;
  username: string;
  accentColor: string;
  isGuest?: boolean;
}

export interface GetProfilesResponse {
  profiles: ProfileWithColor[];
  groupCreatedBy: string;
}

export interface CreateGuestProfileResponse {
  accessToken: string;
}

export interface LoginAsResponse {
  accessToken: string;
}

export interface AddReceiptResponse {
  receiptId: string;
  tax?: number | null;
  ocrTotal?: number | null;
  confidenceScore?: number | null;
  warnings?: string[] | null;
  notes?: string[] | null;
}

export interface AddItemResponse {
  itemId: string;
}

export interface CreateManualReceiptResponse {
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

/**
 * POST /group/receipt/add — upload a receipt image (multipart form).
 * @param groupId  The UUID of the group this receipt belongs to.
 * @param imageUri The local file URI of the receipt photo.
 */
export async function addReceipt(
  groupId: string,
  imageUri: string,
): Promise<AddReceiptResponse> {
  // Probe original dimensions (no compression yet — lossless format check)
  const probe = await manipulateAsync(imageUri, []);
  const { width, height } = probe;

  // Build resize action if either dimension exceeds the limit
  const resizeActions: Parameters<typeof manipulateAsync>[1] = [];
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    resizeActions.push(
      width >= height
        ? { resize: { width: MAX_IMAGE_DIMENSION } }
        : { resize: { height: MAX_IMAGE_DIMENSION } },
    );
  }

  // Transcode to JPEG (with optional resize) — ensures iOS HEIC and other
  // formats become valid JPEG bytes that Google Vision API can process.
  const jpeg = await manipulateAsync(imageUri, resizeActions, {
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

/** DELETE /group/member — remove a guest participant from a group (host only) */
export async function removeGroupMember(
  groupId: string,
  profileId: string,
): Promise<void> {
  return apiFetch<void>('/group/member', {
    method: 'DELETE',
    body: JSON.stringify({ groupId, profileId }),
  });
}

// ─── Item claim endpoints ─────────────────────────────────────────────────────

/** DELETE /group/item — delete an item from a group (any member) */
export async function deleteItem(itemId: string): Promise<void> {
  return apiFetch<void>('/group/item', {
    method: 'DELETE',
    body: JSON.stringify({ itemId }),
  });
}

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

/** POST /group/item/assign-bulk — host assigns multiple items to a specific guest in one request */
export async function assignItems(
  itemIds: string[],
  guestProfileId: string,
): Promise<void> {
  return apiFetch<void>('/group/item/assign-bulk', {
    method: 'POST',
    body: JSON.stringify({ itemIds, guestProfileId }),
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

/** POST /group/item/unassign-bulk — host removes multiple item assignments from a guest in one request */
export async function unassignItems(
  itemIds: string[],
  guestProfileId: string,
): Promise<void> {
  return apiFetch<void>('/group/item/unassign-bulk', {
    method: 'POST',
    body: JSON.stringify({ itemIds, guestProfileId }),
  });
}

// ─── Home screen / summary endpoints ─────────────────────────────────────────

export type PaidStatus = 'verified' | 'pending' | 'requested' | 'unrequested';

export interface GroupSummary {
  groupId: string;
  name: string | null;
  memberCount: number;
  totalClaimed: number;
  totalUploaded: number;
  paidStatus: PaidStatus;
  isFinished: boolean;
  allMembersPaid: boolean;
}

/** POST /group/join — join an existing group as a registered (email) user */
export async function joinGroup(groupId: string): Promise<void> {
  return apiFetch<void>('/group/join', {
    method: 'POST',
    body: JSON.stringify({ groupId }),
  });
}

/** Update the paid_status of a group member via the backend API. */
export async function updatePaidStatus(
  groupId: string,
  profileId: string,
  status: 'verified' | 'pending' | 'requested' | 'unrequested',
): Promise<void> {
  return apiFetch<void>('/group/paid-status', {
    method: 'PATCH',
    body: JSON.stringify({ groupId, profileId, paidStatus: status }),
  });
}

/** PATCH /group/item — update an item's name and/or unit price (any group member) */
export async function updateItem(
  itemId: string,
  name?: string,
  unitPrice?: number,
): Promise<void> {
  return apiFetch<void>('/group/item', {
    method: 'PATCH',
    body: JSON.stringify({ itemId, name, unitPrice }),
  });
}

/** PATCH /group/name — rename a group (any member) */
export async function updateGroupName(
  groupId: string,
  groupName: string,
): Promise<void> {
  return apiFetch<void>('/group/name', {
    method: 'PATCH',
    body: JSON.stringify({ groupId, groupName }),
  });
}

/** PATCH /group/profile/username — update the current user's username */
export async function updateUsername(username: string): Promise<void> {
  return apiFetch<void>('/group/profile/username', {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  });
}

/** DELETE /group/delete — delete a group (host only) */
export async function deleteGroup(groupId: string): Promise<void> {
  return apiFetch<void>('/group/delete', {
    method: 'DELETE',
    body: JSON.stringify({ groupId }),
  });
}

/** POST /group/item/add — manually add a new item to a group */
export async function addItem(
  groupId: string,
  receiptId: string | null,
  name = '',
  unitPrice = 0,
): Promise<AddItemResponse> {
  return apiFetch<AddItemResponse>('/group/item/add', {
    method: 'POST',
    body: JSON.stringify({ groupId, receiptId, name, unitPrice }),
  });
}

/** POST /group/receipt/manual — create a manual (no-image) receipt */
export async function createManualReceipt(
  groupId: string,
  tax: number | null,
): Promise<CreateManualReceiptResponse> {
  return apiFetch<CreateManualReceiptResponse>('/group/receipt/manual', {
    method: 'POST',
    body: JSON.stringify({ groupId, tax }),
  });
}

/** PATCH /group/receipt/tax — update the tax amount on a receipt */
export async function updateReceiptTax(
  receiptId: string,
  tax: number | null,
): Promise<void> {
  return apiFetch<void>('/group/receipt/tax', {
    method: 'PATCH',
    body: JSON.stringify({ receiptId, tax }),
  });
}

/** PATCH /group/finish — mark a group as finished (host only) */
export async function finishGroup(groupId: string): Promise<void> {
  return apiFetch<void>('/group/finish', {
    method: 'PATCH',
    body: JSON.stringify({ groupId }),
  });
}
