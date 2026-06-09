import React from "react";
import LegalLayout from "../components/LegalLayout";

export default function Cookies() {
  return (
    <LegalLayout title="Cookie Policy" updated="January 1, 2025">
      <h2>What are cookies</h2>
      <p>Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and keep you logged in between visits.</p>

      <h2>Cookies we use</h2>
      <p>HCMOrbit uses only essential cookies necessary to operate the platform:</p>
      <ul>
        <li>Authentication cookie: keeps you logged in to your account. Without this cookie, you would need to log in on every page visit. This cookie is deleted when you log out or after your session expires.</li>
        <li>Preference cookie: remembers your display preferences (such as theme settings if applicable). Stored for 30 days.</li>
      </ul>
      <p>We do not use advertising cookies. We do not use third-party tracking cookies. We do not share cookie data with advertisers.</p>

      <h2>Managing cookies</h2>
      <p>You can control cookies through your browser settings. Note that disabling cookies will prevent you from staying logged in and may affect your experience on the platform. Instructions for managing cookies in common browsers:</p>
      <ul>
        <li>Chrome: Settings → Privacy and Security → Cookies</li>
        <li>Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
        <li>Safari: Preferences → Privacy → Manage Website Data</li>
        <li>Edge: Settings → Cookies and Site Permissions</li>
      </ul>

      <h2>Contact</h2>
      <p>For questions about our use of cookies, contact <a href="mailto:support@hcmorbit.com">support@hcmorbit.com</a>.</p>
    </LegalLayout>
  );
}
