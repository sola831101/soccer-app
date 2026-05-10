import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

async function uploadImage(path: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

// 選手顔写真
export async function uploadPlayerPhoto(teamId: string, playerId: string, uri: string): Promise<string> {
  return uploadImage(`playerPhotos/${teamId}/${playerId}/photo.jpg`, uri);
}

export async function deletePlayerPhoto(teamId: string, playerId: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `playerPhotos/${teamId}/${playerId}/photo.jpg`));
  } catch { /* 存在しない場合は無視 */ }
}

// 所属チームアイコン（PlayerStep）
export async function uploadTeamStepIcon(teamId: string, playerId: string, stepId: string, uri: string): Promise<string> {
  return uploadImage(`teamStepIcons/${teamId}/${playerId}/${stepId}.jpg`, uri);
}
