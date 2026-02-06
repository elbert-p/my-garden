'use client';
import NavBar from '@/components/NavBar';
import styles from './page.module.css';

export default function AboutPage() {
  const tabs = [
    { label: 'Gardens', href: '/', active: false },
    { label: 'About', href: '/about', active: true },
  ];

  return (
    <>
      <NavBar
        title="My Gardens"
        showHome={true}
        tabs={tabs}
      />
      
      <div className={styles.container}>
        <div className={styles.content}>
          <h2>About My Gardens</h2>
          <p>This page is coming soon.</p>
          <p>Here you&apos;ll be able to see information about your gardens and account settings.</p>
        </div>
      </div>
    </>
  );
}