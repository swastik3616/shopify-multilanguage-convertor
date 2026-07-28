import React from "react";

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    description: "Perfect for getting started with basic translations.",
    features: [
      "1 Additional Language",
      "Manual Translations",
      "Basic Language Switcher",
      "Community Support"
    ],
    buttonText: "Current Plan",
    highlighted: false
  },
  {
    name: "Pro",
    price: "$19",
    period: "/mo",
    description: "Great for growing stores that need SEO support.",
    features: [
      "Up to 3 Languages",
      "Auto AI Translations",
      "SEO Metadata Translation",
      "Email Support"
    ],
    buttonText: "Upgrade to Pro",
    highlighted: true
  },
  {
    name: "Advance",
    price: "$49",
    period: "/mo",
    description: "Advanced features for high-volume international stores.",
    features: [
      "Up to 10 Languages",
      "Currency Converter Engine",
      "Premium Floating Widget",
      "Priority 24/7 Support"
    ],
    buttonText: "Upgrade to Advance",
    highlighted: false
  },
  {
    name: "Business",
    price: "$99",
    period: "/mo",
    description: "Unlimited power and dedicated support for enterprise.",
    features: [
      "Unlimited Languages",
      "Custom CSS/JS Integration",
      "Dedicated Account Manager",
      "Custom API Access"
    ],
    buttonText: "Upgrade to Business",
    highlighted: false
  }
];

function PricingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      
      {/* Header Section */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Choose the right plan for your Shopify store. Upgrade at any time as your international audience grows.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {pricingPlans.map((plan, index) => (
          <div 
            key={index} 
            className={`relative p-8 bg-white border rounded-2xl flex flex-col transition-all duration-200 ${
              plan.highlighted 
                ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-xl transform lg:-translate-y-4 z-10' 
                : 'border-slate-200 shadow-sm hover:shadow-md'
            }`}
          >
            {/* "Most Popular" Badge for Pro Plan */}
            {plan.highlighted && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold text-white tracking-wide uppercase shadow-sm">
                  Most Popular
                </span>
              </div>
            )}
            
            {/* Plan Title & Description */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-2 text-sm text-slate-500 min-h-[40px]">{plan.description}</p>
            </div>
            
            {/* Price */}
            <div className="mb-6 flex items-baseline text-slate-900">
              <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
              {plan.period && <span className="ml-1 text-lg font-medium text-slate-500">{plan.period}</span>}
            </div>
            
            {/* Feature List */}
            <ul className="mb-8 space-y-4 flex-1">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start">
                  <svg className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-3 text-sm text-slate-700 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
            
            {/* Action Button */}
            <button
              className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                plan.highlighted
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm'
                  : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200 focus:ring-slate-500'
              }`}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PricingPage;
