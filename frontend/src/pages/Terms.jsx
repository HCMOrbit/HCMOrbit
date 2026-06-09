import React from "react";
import LegalLayout from "../components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service" updated="January 1, 2025"
      intro="By using HCMOrbit, you agree to these terms. Please read them carefully. If you do not agree, please do not use the platform."
    >
      <h2>1. About HCMOrbit</h2>
      <p>HCMOrbit is an independent professional community platform for Workday and HCM practitioners. We provide a space for professionals to ask questions, share knowledge, and connect with peers and employers. HCMOrbit is not affiliated with Workday, Inc.</p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 16 years old to use HCMOrbit. By registering, you confirm that the information you provide is accurate and that you are eligible to use the platform. We reserve the right to terminate accounts that provide false information.</p>

      <h2>3. Your account</h2>
      <p>You are responsible for maintaining the security of your account and password. Notify us immediately at <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a> if you suspect unauthorised access. You may not share your account with others or create multiple accounts.</p>

      <h2>4. Community standards</h2>
      <p>HCMOrbit is a professional community. By posting content, you agree to the following standards:</p>
      <ul>
        <li>Be respectful and constructive — personal attacks, harassment, and discrimination are not permitted</li>
        <li>Post accurate information — do not knowingly share false or misleading content</li>
        <li>Stay on topic — content should be relevant to HCM, Workday, and professional development</li>
        <li>No spam or self-promotion — unsolicited advertising or repetitive promotional posts will be removed</li>
        <li>No confidential information — do not post client data, proprietary implementation details, or information covered by an NDA</li>
        <li>No impersonation — do not impersonate other professionals, companies, or Workday Inc.</li>
      </ul>
      <p>Violations of these standards may result in content removal, account suspension, or permanent ban at our discretion.</p>

      <h2>5. Content ownership</h2>
      <p>You retain ownership of the content you post on HCMOrbit. By posting, you grant HCMOrbit a non-exclusive, royalty-free licence to display, distribute, and promote your content within the platform. You represent that you have the right to post any content you submit and that it does not violate any third-party rights.</p>

      <h2>6. Intellectual property</h2>
      <p>The HCMOrbit platform, including its design, code, and branding, is owned by HCMOrbit and protected by intellectual property laws. You may not copy, reproduce, or create derivative works from the platform without written permission. Workday is a trademark of Workday, Inc. HCMOrbit is not affiliated with or endorsed by Workday, Inc.</p>

      <h2>7. Prohibited conduct</h2>
      <p>You may not use HCMOrbit to:</p>
      <ul>
        <li>Violate any applicable law or regulation</li>
        <li>Scrape, crawl, or extract data from the platform without permission</li>
        <li>Attempt to gain unauthorised access to any part of the platform or other users' accounts</li>
        <li>Distribute malware, viruses, or harmful code</li>
        <li>Circumvent any security or access control measures</li>
        <li>Use the platform to facilitate illegal activities</li>
      </ul>

      <h2>8. Disclaimer of warranties</h2>
      <p>HCMOrbit is provided "as is" without warranties of any kind. We do not guarantee that the platform will be error-free, uninterrupted, or free from security vulnerabilities. Content posted by users represents their own views and experience — HCMOrbit does not verify the accuracy of user-generated content.</p>

      <h2>9. Limitation of liability</h2>
      <p>To the maximum extent permitted by law, HCMOrbit shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the platform, even if we have been advised of the possibility of such damages. Our total liability to you for any claims arising from use of the platform shall not exceed the amount you have paid to us in the 12 months preceding the claim.</p>

      <h2>10. Termination</h2>
      <p>We reserve the right to suspend or terminate your account at any time for violation of these terms or for any conduct we determine to be harmful to the community. You may delete your account at any time from your account settings. Upon termination, your right to use the platform ceases immediately.</p>

      <h2>11. Changes to these terms</h2>
      <p>We may update these Terms of Service. We will notify you by email of material changes. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>

      <h2>12. Governing law</h2>
      <p>These terms are governed by the laws of the United States. Any disputes shall be resolved in the courts of the United States, unless otherwise required by applicable local law.</p>

      <h2>13. Contact</h2>
      <p>For questions about these terms, contact us at: <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a></p>
    </LegalLayout>
  );
}
