'use client';
import { useSharedGarden } from '@/context/SharedGardenContext';
import AboutPageContent from '@/components/AboutPageContent';

export default function SharedGardenAboutPage() {
  const { garden } = useSharedGarden();

  if (!garden) return null;

  const defaultBlocks = [
    { id: 'default-img', type: 'image', content: garden.image || '/default-garden.jpg', title: 'Garden image' },
  ];

  const blocks = garden.aboutBlocks?.length > 0 ? garden.aboutBlocks : defaultBlocks;

  return (
    <AboutPageContent
      blocks={blocks}
      onSave={null}
      userId={null}
      title="About This Garden"
    />
  );
}