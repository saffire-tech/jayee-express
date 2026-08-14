import SEO from "@/components/SEO";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
const Terms = () => {
  return <>
      <SEO
        title="Terms of Service | Jayee Express"
        description="Read the Jayee Express Terms of Service: account rules, marketplace guidelines, payments, store verification and dispute resolution for buyers and sellers in Ghana."
        canonicalPath="/terms"
      />
      
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        
        <main className="flex-1 pt-24 pb-8 md:py-12">
          <div className="container px-4 max-w-4xl">
            <h1 className="text-2xl md:text-4xl font-bold mb-2">Terms of Service</h1>
            <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">Last updated: December 2025</p>

            <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 md:space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">By accessing or using the Jayee Express platform, you agree to be bound by these Terms of Service. If you do not agree to these Terms, you may not access or use the Platform. These Terms constitute a legally binding agreement between you and Jayee Express.</p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Jayee Express is a peer-to-peer marketplace platform designed for community members to buy and sell 
                  products and services. The Platform enables users to create stores, list products/services, browse 
                  offerings, communicate with other users, and complete transactions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
                
                <h3 className="text-xl font-medium mt-6 mb-3">3.1 Registration</h3>
                <p className="text-muted-foreground leading-relaxed">
                  To use certain features of the Platform, you must create an account. You agree to provide accurate, 
                  current, and complete information during registration and to update such information as necessary.
                </p>

                <h3 className="text-xl font-medium mt-6 mb-3">3.2 Account Responsibility</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You are responsible for maintaining the confidentiality of your account credentials and for all 
                  activities that occur under your account. You must notify us immediately of any unauthorized use 
                  of your account.
                </p>

                <h3 className="text-xl font-medium mt-6 mb-3">3.3 Account Eligibility</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You must be at least 16 years old to create an account. By creating an account, you represent that 
                  you meet this age requirement and have the legal capacity to enter into these Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Marketplace Rules</h2>
                
                <h3 className="text-xl font-medium mt-6 mb-3">4.1 For Sellers</h3>
                <p className="text-muted-foreground leading-relaxed">As a seller on Jayee Express, you agree to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Provide accurate and complete product/service descriptions</li>
                  <li>Set fair and honest prices in Ghana Cedis (₵)</li>
                  <li>Fulfill orders promptly and professionally</li>
                  <li>Respond to buyer inquiries in a timely manner</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Not list prohibited items (see Section 5)</li>
                  <li>Maintain your store information accurately</li>
                </ul>

                <h3 className="text-xl font-medium mt-6 mb-3">4.2 For Buyers</h3>
                <p className="text-muted-foreground leading-relaxed">As a buyer on Jayee Express, you agree to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Provide accurate delivery/contact information</li>
                  <li>Complete payment for orders you place</li>
                  <li>Communicate respectfully with sellers</li>
                  <li>Report any issues through proper channels</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Prohibited Items and Activities</h2>
                <p className="text-muted-foreground leading-relaxed">The following are strictly prohibited on Jayee Express:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Illegal drugs, narcotics, or controlled substances</li>
                  <li>Weapons, ammunition, or explosives</li>
                  <li>Counterfeit or pirated goods</li>
                  <li>Stolen property</li>
                  <li>Adult content or services</li>
                  <li>Alcohol and tobacco products</li>
                  <li>Hazardous materials</li>
                  <li>Items that infringe intellectual property rights</li>
                  <li>Academic fraud services (essay writing, exam taking, etc.)</li>
                  <li>Any items prohibited by Ghanaian law</li>
                  <li>Fraudulent schemes or scams</li>
                  <li>Harassment or threatening behavior</li>
                  <li>Spam or misleading content</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Store Verification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  All stores on Jayee Express are subject to verification and approval by our administrators. Stores must 
                  meet our quality and safety standards before they can be visible to other users. We reserve the 
                  right to reject, suspend, or remove any store that violates these Terms or our community guidelines.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Transactions and Payments</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Jayee Express facilitates connections between buyers and sellers but is not a party to any transaction. 
                  All transactions are conducted directly between users. You are responsible for:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Agreeing on payment methods with the other party</li>
                  <li>Ensuring safe exchange of goods/services</li>
                  <li>Resolving disputes directly with the other party</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  All prices on the Platform are displayed in Ghana Cedis (₵). Jayee Express does not process payments 
                  directly and is not responsible for payment disputes between users.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. User Content</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By posting content on Jayee Express (including product listings, images, store information, and messages), 
                  you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute such 
                  content on our Platform. You retain ownership of your content and are responsible for ensuring it 
                  does not violate any laws or third-party rights.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Messaging Guidelines</h2>
                <p className="text-muted-foreground leading-relaxed">When using our messaging feature, you agree to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Communicate respectfully and professionally</li>
                  <li>Use messaging only for Platform-related purposes</li>
                  <li>Not send spam, promotional content, or unsolicited messages</li>
                  <li>Not share inappropriate or offensive content</li>
                  <li>Report any abusive or suspicious messages</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Account Suspension and Termination</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to suspend or terminate your account at any time, with or without notice, for:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Violation of these Terms</li>
                  <li>Fraudulent or illegal activity</li>
                  <li>Behavior that harms other users or the Platform</li>
                  <li>Any other reason we deem necessary to protect our community</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Upon suspension, you will be immediately logged out and unable to access the Platform until 
                  the suspension is lifted.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Jayee Express is a platform that connects buyers and sellers. We are not responsible for:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>The quality, safety, or legality of items listed</li>
                  <li>The accuracy of listings or user content</li>
                  <li>The ability of sellers to sell or buyers to pay</li>
                  <li>Any disputes between users</li>
                  <li>Any losses or damages arising from transactions</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  To the maximum extent permitted by law, Jayee Express shall not be liable for any indirect, incidental, 
                  special, consequential, or punitive damages arising from your use of the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Dispute Resolution</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have a dispute with another user, we encourage you to resolve it directly with them. 
                  If you are unable to resolve the dispute, you may report it to us through the "Report an Issue" 
                  feature. We will review reports and may take action, but we are not obligated to mediate or 
                  resolve disputes between users.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Jayee Express name, logo, and all related trademarks, service marks, and logos are the property 
                  of Jayee Express. You may not use our intellectual property without our prior written consent. 
                  The Platform and its original content, features, and functionality are owned by Jayee Express and 
                  are protected by copyright, trademark, and other intellectual property laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of any changes by 
                  posting the new Terms on this page and updating the "Last updated" date. Your continued use of 
                  the Platform after such changes constitutes your acceptance of the new Terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">15. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms, please contact us:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-3">
                  <li>Through the "Report an Issue" feature in the app</li>
                  <li>By email at: saffiretech01@gmail.com</li>
                </ul>
              </section>

              <section className="bg-muted/50 rounded-xl p-6 mt-8">
                <p className="text-sm text-muted-foreground">
                  <strong>Governing Law:</strong> These Terms are governed by the laws of the Republic of Ghana. 
                  Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Ghana.
                </p>
              </section>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>;
};
export default Terms;
