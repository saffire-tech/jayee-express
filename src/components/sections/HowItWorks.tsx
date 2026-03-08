import { UserPlus, Store, Package, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: UserPlus,
    title: "Sign Up",
    description: "Create your free account in seconds",
    step: "01"
  },
  {
    icon: Store,
    title: "Create Store",
    description: "Set up your store and start selling",
    step: "02"
  },
  {
    icon: Package,
    title: "List & Sell",
    description: "Upload products with prices & delivery options",
    step: "03"
  },
  {
    icon: CreditCard,
    title: "Get Paid",
    description: "Receive payments securely and grow",
    step: "04"
  }
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-12 md:py-20 bg-muted/30">
      <div className="container px-4">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <p className="text-xs font-semibold text-primary tracking-widest mb-2">HOW IT WORKS</p>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Start in 4 Simple Steps
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Whether you're looking to sell or buy, getting started is quick and easy
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="relative text-center group p-4 md:p-6 rounded-2xl bg-card border border-border/60 hover:border-primary/20 transition-all hover:shadow-md"
            >
              {/* Step Number */}
              <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground shadow-sm">
                {step.step}
              </div>

              {/* Icon */}
              <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/8 mb-3 group-hover:bg-primary/12 transition-colors">
                <step.icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>

              {/* Content */}
              <h3 className="text-sm md:text-base font-bold text-foreground mb-1">{step.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
