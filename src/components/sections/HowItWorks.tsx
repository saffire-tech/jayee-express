import { UserPlus, Store, Package, CreditCard } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Sign Up",
    description: "Create your free account in seconds using your email",
    step: "01"
  },
  {
    icon: Store,
    title: "Create Your Store",
    description: "Set up your store, add products or services, and start selling",
    step: "02"
  },
  {
    icon: Package,
    title: "List & Sell",
    description: "Upload your products with prices and delivery options",
    step: "03"
  },
  {
    icon: CreditCard,
    title: "Get Paid",
    description: "Receive payments securely and grow your business",
    step: "04"
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-background">
      <div className="container px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <p className="text-primary font-semibold mb-3">HOW IT WORKS</p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Start in 4 Simple Steps
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you're looking to sell or buy, getting started is quick and easy
          </p>
        </div>

        {/* Steps - 2x2 grid on mobile, 4 columns on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative text-center group p-4 md:p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              {/* Connector Line - hidden on mobile */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 left-full w-4 h-[2px] bg-gradient-to-r from-primary/30 to-transparent -translate-y-1/2" />
              )}

              {/* Step Number */}
              <div className="absolute -top-2 -right-2 w-6 h-6 md:w-8 md:h-8 rounded-full gradient-primary flex items-center justify-center text-xs md:text-sm font-bold text-primary-foreground">
                {step.step}
              </div>

              {/* Icon */}
              <div className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-accent mb-3 md:mb-5 group-hover:shadow-glow transition-all duration-300">
                <step.icon className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>

              {/* Content */}
              <h3 className="text-sm md:text-lg font-bold text-foreground mb-1 md:mb-2">{step.title}</h3>
              <p className="text-xs md:text-sm text-muted-foreground line-clamp-3">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
