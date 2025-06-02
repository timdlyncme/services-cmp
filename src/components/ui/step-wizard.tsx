import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepWizardProps {
  steps: Array<{
    id: number;
    title: string;
    description?: string;
  }>;
  currentStep: number;
  className?: string;
}

export const StepWizard: React.FC<StepWizardProps> = ({
  steps,
  currentStep,
  className,
}) => {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  {
                    "border-orange-500 bg-orange-500 text-white": step.id <= currentStep,
                    "border-gray-300 bg-white text-gray-500": step.id > currentStep,
                  }
                )}
              >
                {step.id < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </div>
              <div className="mt-2 text-center">
                <div
                  className={cn(
                    "text-sm font-medium",
                    {
                      "text-orange-600": step.id <= currentStep,
                      "text-gray-500": step.id > currentStep,
                    }
                  )}
                >
                  {step.title}
                </div>
                {step.description && (
                  <div
                    className={cn(
                      "text-xs",
                      {
                        "text-orange-500": step.id <= currentStep,
                        "text-gray-400": step.id > currentStep,
                      }
                    )}
                  >
                    {step.description}
                  </div>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-4",
                  {
                    "bg-orange-500": step.id < currentStep,
                    "bg-gray-300": step.id >= currentStep,
                  }
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
