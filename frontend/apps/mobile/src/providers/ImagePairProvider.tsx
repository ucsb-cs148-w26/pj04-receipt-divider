import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useMemo,
} from 'react';

interface ImagePairContextType {
  uncroppedImageURL: string | null;
  croppedImageURL?: string | null;
  setUncroppedImageURL: React.Dispatch<React.SetStateAction<string | null>>;
  setCroppedImageURL: React.Dispatch<React.SetStateAction<string | null>>;
}

const ImagePairContext = createContext<ImagePairContextType | undefined>(
  undefined,
);

export function ImagePairProvider({ children }: { children: React.ReactNode }) {
  const [uncroppedImageURL, setUncroppedImageURL] = useState<string | null>(
    null,
  );
  const [croppedImageURL, setCroppedImageURL] = useState<string | null>(null);

  const value = useMemo<imagePairContextType>(
    () => ({
      uncroppedImageURL,
      setUncroppedImageURL,
      croppedImageURL,
      setCroppedImageURL,
    }),
    [uncroppedImageURL, croppedImageURL],
  );

  return (
    <ImagePairContext.Provider value={value}>
      {children}
    </ImagePairContext.Provider>
  );
}

export function useImagePair() {
  const context = useContext(ImagePairContext);
  if (!context) {
    throw new Error('useImagePair must be used within ImagePairProvider');
  }
  return context;
}
