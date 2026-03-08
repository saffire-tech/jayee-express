import { Helmet } from "react-helmet-async";
import { Download, Smartphone, Apple, CheckCircle, Share, PlusSquare, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import shodelLogo from "@/assets/shodel-logo.png";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const DownloadPage = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isStandalone, install } = usePWAInstall();

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      console.log("App installed successfully!");
    }
  };

  // Check if on desktop
  const isDesktop = !isIOS && !isAndroid;

  return (
    <>
      <Helmet>
        <title>Download Shodel App | iOS & Android</title>
        <meta name="description" content="Install the Shodel app on your device. Shop and sell on campus with ease." />
      </Helmet>
      
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        
        <main className="flex-1 pt-24 pb-12 md:py-16">
          <div className="container px-4">
            {/* Hero Section */}
            <div className="text-center mb-10 md:mb-16">
              <img 
                src={shodelLogo} 
                alt="Shodel" 
                className="h-16 md:h-20 w-auto mx-auto mb-4 md:mb-6" 
              />
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4">
                {isInstalled || isStandalone ? "App Installed!" : "Get the Shodel App"}
              </h1>
              <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
                {isInstalled || isStandalone
                  ? "You're all set! The Shodel app is ready to use on your device."
                  : "Install our app for a better shopping and selling experience on the go. Works offline and loads instantly!"}
              </p>
            </div>

            {/* Already Installed State */}
            {(isInstalled || isStandalone) && (
              <div className="max-w-md mx-auto mb-10 md:mb-16">
                <Card className="border-2 border-green-500/50 bg-green-500/5">
                  <CardContent className="p-6 md:p-8 text-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                      <CheckCircle className="h-8 w-8 md:h-10 md:w-10 text-white" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold mb-2">Already Installed</h2>
                    <p className="text-sm md:text-base text-muted-foreground">
                      The Shodel app is installed on your device. You can find it on your home screen.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Desktop View */}
            {isDesktop && !isInstalled && !isStandalone && (
              <div className="max-w-md mx-auto mb-10 md:mb-16">
                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 md:p-8 text-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6">
                      <Monitor className="h-8 w-8 md:h-10 md:w-10 text-primary-foreground" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold mb-2">Open on Mobile</h2>
                    <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">
                      For the best experience, visit this page on your mobile device to install the app.
                    </p>
                    {isInstallable && (
                      <Button 
                        onClick={handleInstall}
                        size="lg" 
                        className="w-full h-12 md:h-11"
                      >
                        <Download className="mr-2 h-5 w-5" />
                        Install on Desktop
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Mobile Install Options */}
            {!isDesktop && !isInstalled && !isStandalone && (
              <div className="grid grid-cols-1 gap-4 md:gap-8 max-w-lg mx-auto mb-10 md:mb-16">
                {/* Android - Direct Install */}
                {isAndroid && (
                  <Card className="border-2 border-green-500/50 hover:border-green-500 transition-colors">
                    <CardContent className="p-6 md:p-8 text-center">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6">
                        <Smartphone className="h-8 w-8 md:h-10 md:w-10 text-white" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold mb-2">Install Shodel</h2>
                      <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">
                        Tap the button below to add Shodel to your home screen
                      </p>
                      {isInstallable ? (
                        <Button 
                          onClick={handleInstall}
                          size="lg" 
                          className="w-full bg-green-600 hover:bg-green-700 h-12 md:h-11"
                        >
                          <Download className="mr-2 h-5 w-5" />
                          Install Now
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Loading install option...
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* iOS - Manual Instructions */}
                {isIOS && (
                  <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardContent className="p-6 md:p-8 text-center">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-foreground rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6">
                        <Apple className="h-8 w-8 md:h-10 md:w-10 text-background" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-bold mb-2">Add to Home Screen</h2>
                      <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">
                        Follow these simple steps to install Shodel on your iPhone
                      </p>
                      
                      <div className="text-left space-y-4 bg-muted/50 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Share className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Step 1</p>
                            <p className="text-sm text-muted-foreground">Tap the <strong>Share</strong> button at the bottom of Safari</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <PlusSquare className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Step 2</p>
                            <p className="text-sm text-muted-foreground">Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">Step 3</p>
                            <p className="text-sm text-muted-foreground">Tap <strong>"Add"</strong> in the top right corner</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Features */}
            <div className="mt-10 md:mt-16 text-center">
              <h2 className="text-xl md:text-2xl font-bold mb-6 md:mb-8">Why Install the App?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
                <div className="p-4 md:p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <span className="text-2xl">🚀</span>
                  </div>
                  <h3 className="font-semibold mb-1 md:mb-2">Faster Experience</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Loads instantly from your home screen</p>
                </div>
                <div className="p-4 md:p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <span className="text-2xl">📴</span>
                  </div>
                  <h3 className="font-semibold mb-1 md:mb-2">Works Offline</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Browse products even without internet</p>
                </div>
                <div className="p-4 md:p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                    <span className="text-2xl">📱</span>
                  </div>
                  <h3 className="font-semibold mb-1 md:mb-2">Native Feel</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">Full-screen app experience</p>
                </div>
              </div>
            </div>

            {/* Note about notifications */}
            <div className="mt-10 md:mt-12 max-w-2xl mx-auto">
              <div className="bg-muted/50 rounded-xl p-4 md:p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Push notifications are supported on Android. iOS users may have limited notification support depending on their iOS version (16.4+).
                </p>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default DownloadPage;
