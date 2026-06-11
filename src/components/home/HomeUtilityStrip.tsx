import { Truck, ShieldCheck, Lock } from "lucide-react";

const items = [
  { icon: Truck, label: "Fast local delivery across Ghana" },
  { icon: ShieldCheck, label: "Buyer protection & verified stores" },
  { icon: Lock, label: "100% secure Paystack payments" },
];

const HomeUtilityStrip = () => {
  return (
    <div className="hidden md:block w-full bg-primary text-primary-foreground">
      <div className="container px-4">
        <div className="h-10 flex items-center justify-center gap-8 text-xs font-medium">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeUtilityStrip;
