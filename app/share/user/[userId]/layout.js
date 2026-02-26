'use client';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SharedProfileProvider, useSharedProfile } from '@/context/SharedProfileContext';
import NavBar from '@/components/NavBar';
import styles from './layout.module.css';

function SharedProfileLayoutContent({ children }) {
  const { userId } = useParams();
  const pathname = usePathname();
  const { profile, isLoading, error } = useSharedProfile();

  const isAboutPage = pathname.endsWith('/about');

  const tabs = [
    { label: 'Gardens', href: `/share/user/${userId}`, active: !isAboutPage },
    { label: 'About', href: `/share/user/${userId}/about`, active: isAboutPage },
  ];

  const owner = profile ? {
    id: profile.id,
    display_name: profile.display_name,
    email: profile.email,
    avatar_url: profile.avatar_url,
  } : null;

  if (!isLoading && error) {
    return (
      <>
        <NavBar title="Not Found" showHome={true} />
        <div className={styles.container}>
          <p className={styles.message}>{error}</p>
          <Link href="/" className={styles.homeLink}>Go to My Gardens</Link>
        </div>
      </>
    );
  }

  const displayName = profile?.display_name || 'User';

  return (
    <>
      <NavBar
        title={isLoading ? '' : `${displayName}'s Gardens`}
        showHome={true}
        tabs={tabs}
        sharedBy={owner}
      />
      {isLoading ? (
        <div className={styles.container}>
          <p className={styles.loading}>Loading...</p>
        </div>
      ) : (
        children
      )}
    </>
  );
}

export default function SharedProfileLayout({ children }) {
  return (
    <SharedProfileProvider>
      <SharedProfileLayoutContent>
        {children}
      </SharedProfileLayoutContent>
    </SharedProfileProvider>
  );
}