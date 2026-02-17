'use client';
import { useGarden } from '@/context/GardenContext';
import AboutPageContent from '@/components/AboutPageContent';

export default function GardenAboutPage() {
  const { garden, user, updateGardenAbout } = useGarden();

  if (!garden) return null;

  const defaultBlocks = [
    { id: 'default-text', type: 'text', title: 'Description', content: '' },
    { id: 'default-img', type: 'image', content: garden.image || '/default-garden.jpg', title: 'Garden image' },
  ];

  const blocks = garden.aboutBlocks?.length > 0 ? garden.aboutBlocks : defaultBlocks;

  return (
    <AboutPageContent
      blocks={blocks}
      onSave={updateGardenAbout}
      userId={user?.id}
      title="About This Garden"
    />
  );
}