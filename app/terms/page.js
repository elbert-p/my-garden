import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'Terms of Service — My Garden',
  description: 'The terms for using My Garden.',
};

export default function TermsOfServicePage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.back}>← Back to My Garden</Link>

        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.updated}>Last updated: August 7, 2026</p>

        <p>
          My Garden is a personal, independently built web app for cataloging and sharing garden
          plants. By using it, you agree to these terms. It&rsquo;s run by one developer as a
          side project, so please read the disclaimers below.
        </p>

        <h2 className={styles.heading}>Your account and content</h2>
        <p>
          You can use the app without an account (your data stays in your browser) or sign in with
          Google to sync it. You should be at least 13. The gardens, plants, images, and notes you
          create are yours; you just grant me permission to store and display them so the app works,
          and to show anything you choose to share publicly. Only upload images and content you have
          the right to use.
        </p>

        <h2 className={styles.heading}>Fair use</h2>
        <p>
          Please don&rsquo;t upload illegal or infringing content, try to break into the app or other
          people&rsquo;s accounts, or disrupt or overload the service.
        </p>

        <h2 className={styles.heading}>About the plant info</h2>
        <p>
          The app suggests and autofills plant details for convenience. That data can be wrong or
          incomplete and is not horticultural, medical, or safety advice — don&rsquo;t rely on it to
          decide whether a plant is safe to handle, eat, or grow. Always double-check with a trusted
          source.
        </p>

        <h2 className={styles.heading}>No warranty</h2>
        <p>
          The app is provided &ldquo;as is,&rdquo; without guarantees that it will always work, be
          error-free, or preserve your data. To the extent the law allows, I&rsquo;m not liable for
          any damages or data loss from using it, and I&rsquo;d strongly suggest keeping your own copy
          of anything important. I may change or discontinue the app, and may suspend access that
          violates these terms.
        </p>

        <h2 className={styles.heading}>Third-party services</h2>
        <p>
          The app relies on Google (sign-in) and Supabase and Vercel (hosting, storage, analytics);
          using it also means those providers&rsquo; terms apply.
        </p>

        <h2 className={styles.heading}>Contact</h2>
        <p>
          Questions? Email{' '}
          <a className={styles.link} href="mailto:philipelbert7@gmail.com">philipelbert7@gmail.com</a>.
          If these terms change, the date above will change too.
        </p>
      </div>
    </main>
  );
}
