'use client';
import { useSharedProfile } from '@/context/SharedProfileContext';
import AboutPageContent from '@/components/AboutPageContent';

export default function SharedProfileAboutPage() {
  const { profile } = useSharedProfile();

  if (!profile) return null;

  const defaultBlocks = [
    { id: 'default-text', type: 'text', title: 'About', content: '' },
  ];

  const blocks = profile.about_blocks?.length > 0 ? profile.about_blocks : defaultBlocks;

  return (
    <AboutPageContent
      blocks={blocks}
      onSave={null}
      userId={null}
      title={`About ${profile.display_name || 'User'}`}
    />
  );
}