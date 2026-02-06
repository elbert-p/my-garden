'use client';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SharedGardenProvider, useSharedGarden } from '@/context/SharedGardenContext';
import NavBar from '@/components/NavBar';
import styles from './layout.module.css';

function SharedGardenLayoutContent({ children }) {
  const { gardenId } = useParams();
  const pathname = usePathname();
  
  const { garden, owner, isLoading, error, searchQuery, setSearchQuery } = useSharedGarden();

  // Determine active tab and content width
  const isAboutPage = pathname.endsWith('/about');
  const isPlantPage = pathname.includes('/plant/');
  
  // Plant pages use narrower content width
  const contentWidth = isPlantPage ? 'medium' : 'large';
  
  // Plants tab is active on both garden list and plant detail pages
  const tabs = [
    { label: 'Plants', href: `/share/${gardenId}`, active: !isAboutPage },
    { label: 'About', href: `/share/${gardenId}/about`, active: isAboutPage },
  ];

  // Loading state
  if (isLoading) {
    return (
      <>
        <NavBar title="" showHome={true} contentWidth={contentWidth} />
        <div className={styles.container}>
          <p className={styles.loading}>Loading...</p>
        </div>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <NavBar title="Not Found" showHome={true} contentWidth={contentWidth} />
        <div className={styles.container}>
          <p className={styles.message}>{error}</p>
          <Link href="/" className={styles.homeLink}>Go to My Gardens</Link>
        </div>
      </>
    );
  }

  if (!garden) return null;

  return (
    <>
      <NavBar
        title={garden.name}
        showHome={true}
        tabs={tabs}
        showSearch={!isPlantPage && !isAboutPage}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search plants..."
        sharedBy={owner}
        contentWidth={contentWidth}
      />
      {children}
    </>
  );
}

export default function SharedGardenLayout({ children }) {
  return (
    <SharedGardenProvider>
      <SharedGardenLayoutContent>
        {children}
      </SharedGardenLayoutContent>
    </SharedGardenProvider>
  );
}