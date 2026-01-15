import { CameraPage } from '@/components/camera-page';
import { useRouter } from 'expo-router';

export default function CameraScreen() {
  const router = useRouter();

  return (
    <CameraPage
      onBack={() => router.back()}
      onTakePicture={() => router.push('/camera-screen')}
    />
  );
}