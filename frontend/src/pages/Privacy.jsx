import React from "react";
import LegalLayout from "../components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout
      title="Privacy Policy" updated="January 1, 2025"
      intro="HCMOrbit is committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights as a user."
    >
      <h2>1. Who we are</h2>
      <p>HCMOrbit ("we", "us", "our") is an independent professional community platform for HCM and Workday professionals. We are not affiliated with Workday, Inc. Our platform is accessible at hcmorbit.com. For any privacy-related questions, contact us at <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a>.</p>

      <h2>2. What data we collect</h2>
      <p>We collect the following categories of personal data:</p>
      <ul>
        <li>Account data: your name, email address, username, and password (stored as a hashed value — we never store your actual password)</li>
        <li>Profile data: your bio, professional background, Workday modules, years of experience, company name, and LinkedIn URL — all provided voluntarily</li>
        <li>Content data: posts, answers, comments, and knowledge base documents you create on the platform</li>
        <li>Usage data: pages visited, features used, and interactions with content (votes, bookmarks, views) — collected to improve the platform</li>
        <li>Technical data: IP address, browser type, device type, and operating system — collected automatically when you use the platform</li>
      </ul>
      <p>We do not collect payment card information. We do not sell your data to third parties.</p>

      <h2>3. How we use your data</h2>
      <p>We use your data to:</p>
      <ul>
        <li>Provide, operate, and maintain the HCMOrbit platform</li>
        <li>Personalise your experience (showing relevant content based on your group and modules)</li>
        <li>Send essential service emails (account verification, password reset, important platform updates)</li>
        <li>Improve the platform through aggregate usage analytics</li>
        <li>Comply with legal obligations</li>
      </ul>
      <p>We do not use your data for advertising. We do not share your data with advertisers.</p>

      <h2>4. Data storage and security</h2>
      <p>Your data is stored securely using industry-standard cloud infrastructure. Data is stored in servers located in the United States. We implement industry-standard security measures including encryption in transit (HTTPS/TLS) and at rest. Access to user data is restricted to authorised personnel only. While we take reasonable steps to protect your data, no system is completely secure. If you discover a security vulnerability, please report it to <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a>.</p>

      <h2>5. Cookies and tracking</h2>
      <p>We use cookies to keep you logged in and remember your preferences. We do not use tracking cookies for advertising. See our <a href="/cookies">Cookie Policy</a> for full details.</p>

      <h2>6. Your rights</h2>
      <p>Depending on your location, you may have the following rights regarding your personal data:</p>
      <ul>
        <li>Right to access: request a copy of the data we hold about you</li>
        <li>Right to correction: request that we correct inaccurate data</li>
        <li>Right to deletion: request that we delete your account and associated data</li>
        <li>Right to data portability: request your data in a machine-readable format</li>
        <li>Right to object: object to certain types of processing</li>
      </ul>
      <p>To exercise any of these rights, email <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a>. We will respond within 30 days.</p>

      <h2>7. Data retention</h2>
      <p>We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal compliance purposes. Content you have posted (questions, answers, documents) may be retained in anonymised form to preserve community value.</p>

      <h2>8. Third-party services</h2>
      <p>We use third-party services to operate the platform (cloud database, hosting, transactional email). These providers process data on our behalf under appropriate data processing agreements.</p>

      <h2>9. Children's privacy</h2>
      <p>HCMOrbit is not intended for users under the age of 16. We do not knowingly collect personal data from children. If you believe a child has created an account, please contact <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a> and we will delete the account promptly.</p>

      <h2>10. Changes to this policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify registered users by email of any material changes. Continued use of the platform after changes constitutes acceptance of the updated policy. The "Last updated" date at the top of this page reflects the most recent revision.</p>

      <h2>11. Contact</h2>
      <p>For privacy-related questions or requests, contact us at: <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a></p>
    </LegalLayout>
  );
}
