import { Helmet } from "react-helmet-async";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
const PrivacyPolicy = () => {
  return <>
      <Helmet>
        <title>Privacy Policy | Shodel</title>
        <meta name="description" content="Shodel Privacy Policy - Learn how we collect, use, and protect your personal information." />
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        
        <main className="flex-1 pt-24 pb-8 md:py-12">
          <div className="container px-4 max-w-4xl">
            <h1 className="text-2xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
            <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">Last updated: December 2025</p>

            <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 md:space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed">Welcome to Shodel. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and website (collectively, the "Platform").</p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  By using Shodel, you agree to the collection and use of information in accordance with this policy. 
                  If you do not agree with our policies and practices, please do not use our Platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-medium mt-6 mb-3">2.1 Personal Information You Provide</h3>
                <p className="text-muted-foreground leading-relaxed">We collect information that you voluntarily provide when you:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Create an account (name, email address, phone number)</li>
                  <li>Set up a store (store name, description, location, contact details)</li>
                  <li>List products or services (product information, images, pricing)</li>
                  <li>Complete a transaction (order details, delivery information)</li>
                  <li>Communicate with other users (messages, inquiries)</li>
                  <li>Contact our support team</li>
                </ul>

                <h3 className="text-xl font-medium mt-6 mb-3">2.2 Information Collected Automatically</h3>
                <p className="text-muted-foreground leading-relaxed">When you use our Platform, we may automatically collect:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Device information (device type, operating system, unique device identifiers)</li>
                  <li>Usage data (pages visited, features used, time spent on the Platform)</li>
                  <li>Location data (with your consent, for location-based features)</li>
                  <li>Log data (IP address, browser type, access times)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Provide, maintain, and improve our Platform</li>
                  <li>Process transactions and send related information</li>
                  <li>Facilitate communication between buyers and sellers</li>
                  <li>Send you notifications about orders, messages, and updates</li>
                  <li>Respond to your comments, questions, and support requests</li>
                  <li>Monitor and analyze usage patterns to improve user experience</li>
                  <li>Detect, prevent, and address technical issues and fraud</li>
                  <li>Enforce our Terms of Service and protect user safety</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Information Sharing</h2>
                <p className="text-muted-foreground leading-relaxed">We may share your information in the following situations:</p>
                
                <h3 className="text-xl font-medium mt-6 mb-3">4.1 With Other Users</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you make a purchase or inquiry, sellers can see your name and contact information necessary 
                  to complete the transaction. Similarly, buyers can see store and seller information.
                </p>

                <h3 className="text-xl font-medium mt-6 mb-3">4.2 With Service Providers</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may share information with third-party service providers who perform services on our behalf, 
                  such as hosting, analytics, and customer support.
                </p>

                <h3 className="text-xl font-medium mt-6 mb-3">4.3 For Legal Reasons</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may disclose information if required by law or in response to valid legal requests, 
                  or to protect our rights, privacy, safety, or property.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement appropriate technical and organizational security measures to protect your personal 
                  information against unauthorized access, alteration, disclosure, or destruction. However, no method 
                  of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee 
                  absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your personal information for as long as your account is active or as needed to provide 
                  you services. We may also retain and use your information to comply with legal obligations, 
                  resolve disputes, and enforce our agreements.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
                <p className="text-muted-foreground leading-relaxed">You have the right to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Access the personal information we hold about you</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion of your personal information</li>
                  <li>Object to processing of your information</li>
                  <li>Request restriction of processing</li>
                  <li>Withdraw consent at any time (where applicable)</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  To exercise these rights, please contact us through the Report an Issue feature or email us directly.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Shodel is designed for community members and is not intended for children under 16 years of age. 
                  We do not knowingly collect personal information from children under 16. If you are a parent or 
                  guardian and believe your child has provided us with personal information, please contact us.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
                  the new Privacy Policy on this page and updating the "Last updated" date. You are advised to review 
                  this Privacy Policy periodically for any changes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Through the "Report an Issue" feature in the app</li>
                  <li>By email at: saffiretech01@gmail.com</li>
                </ul>
              </section>

              <section className="bg-muted/50 rounded-xl p-6 mt-8">
                <p className="text-sm text-muted-foreground">
                  <strong>Governing Law:</strong> This Privacy Policy is governed by the laws of the Republic of Ghana. 
                  Any disputes arising from this policy shall be subject to the exclusive jurisdiction of the courts of Ghana.
                </p>
              </section>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>;
};
export default PrivacyPolicy;
