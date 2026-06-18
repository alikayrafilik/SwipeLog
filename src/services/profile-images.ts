import { Directory, File, Paths } from 'expo-file-system';

export type ProfileImageKind = 'avatar' | 'cover';

const profileImagesDirectory = new Directory(Paths.document, 'profile-images');

const getExtension = (fileName?: string | null, uri?: string) => {
  const candidate = fileName || uri || '';
  const extension = candidate.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1]?.toLowerCase();
  return extension && extension.length <= 5 ? extension : 'jpg';
};

export const persistProfileImage = async (
  sourceUri: string,
  kind: ProfileImageKind,
  fileName?: string | null
) => {
  profileImagesDirectory.create({ idempotent: true, intermediates: true });

  const destination = new File(
    profileImagesDirectory,
    `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${getExtension(fileName, sourceUri)}`
  );
  await new File(sourceUri).copy(destination);
  return destination.uri;
};
