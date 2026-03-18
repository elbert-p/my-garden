'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSharedGarden } from '@/context/SharedGardenContext';
import AboutPageContent from '@/components/AboutPageContent';

export default function SharedGardenAboutPage() {
  const router = useRouter();
  const { garden, gardenId, visibleAboutBlocks, hasVisibleAbout, isLoading } = useSharedGarden();

  // Redirect to plants page if all about blocks are hidden
  useEffect(() => {
    if (!isLoading && garden && !hasVisibleAbout) {
      router.replace(`/share/${gardenId}`);
    }
  }, [isLoading, garden, hasVisibleAbout, gardenId, router]);

  if (!garden || !hasVisibleAbout) return null;

  return (
    <AboutPageContent
      blocks={visibleAboutBlocks}
      onSave={null}
      userId={null}
      title="About This Garden"
    />
  );
}