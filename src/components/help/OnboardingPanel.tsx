import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, PauseCircle, PlayCircle } from 'lucide-react';
import { generateOnboardingPlan, markOnboardingStep, type OnboardingStep } from '@/help/onboardingEngine';
import { usePermissions } from '@/security/usePermissions';
import type { Role } from '@/security/rbac';
import type { HelpRole } from '@/help/types';

function mapRole(role: Role | undefined): HelpRole {
  if (role === 'ADMIN' || role === 'MANAGER') return 'Manager/Admin';
  if (role === 'SERVICE_WRITER') return 'Service Writer';
  return 'Technician';
}

function StepCard({
  step,
  onComplete,
  onSkip,
}: {
  step: OnboardingStep;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/70 bg-muted/20">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 text-left">
          {step.status === 'mastered' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <PlayCircle className="w-4 h-4 text-primary" />
          )}
          <span>{step.playbookTitle}</span>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2 text-sm">
          <div>
            <div className="font-semibold text-foreground">Purpose</div>
            <div className="text-muted-foreground">{step.purpose}</div>
          </div>
          <div>
            <div className="font-semibold text-foreground">Why it matters</div>
            <div className="text-muted-foreground">{step.whyMatters}</div>
          </div>
          <div>
            <div className="font-semibold text-foreground">Guided action</div>
            <div className="text-muted-foreground">{step.guidedAction}</div>
          </div>
          <div>
            <div className="font-semibold text-foreground">Watch out for</div>
            <div className="text-muted-foreground">{step.watchOut}</div>
          </div>
          <div>
            <div className="font-semibold text-foreground">Verify</div>
            <div className="text-muted-foreground">{step.verify}</div>
          </div>
          {step.related.length > 0 && (
            <div>
              <div className="font-semibold text-foreground">Related help</div>
              <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                {step.related.map((rel) => (
                  <li key={rel}>{rel}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {step.status !== 'mastered' && (
              <>
                <button
                  type="button"
                  className="text-xs inline-flex items-center gap-1 rounded border px-2 py-1"
                  onClick={onComplete}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Mark done
                </button>
                <button
                  type="button"
                  className="text-xs inline-flex items-center gap-1 rounded border px-2 py-1"
                  onClick={onSkip}
                >
                  <PauseCircle className="w-3 h-3" />
                  Skip for now
                </button>
              </>
            )}
            {step.status === 'mastered' && (
              <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Mastered
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function OnboardingPanel() {
  const { role } = usePermissions();
  const helpRole = useMemo(() => mapRole(role), [role]);
  const plan = useMemo(() => generateOnboardingPlan(helpRole), [helpRole]);
  const visibleSteps = plan.filter((step) => step.status !== 'mastered');
  const masteredSteps = plan.filter((step) => step.status === 'mastered');

  const handleComplete = (step: OnboardingStep) => {
    markOnboardingStep(helpRole, step.id, step.playbookTitle, 'completed', step.frictionTag);
  };

  const handleSkip = (step: OnboardingStep) => {
    markOnboardingStep(helpRole, step.id, step.playbookTitle, 'skipped', step.frictionTag);
  };

  if (plan.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Onboarding for {helpRole}</div>
        <div className="text-xs text-muted-foreground">Progressive, non-blocking</div>
      </div>
      {visibleSteps.length === 0 && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          All steps mastered from recent activity. You can resume anytime.
        </div>
      )}
      {visibleSteps.map((step) => (
        <StepCard
          key={step.id}
          step={step}
          onComplete={() => handleComplete(step)}
          onSkip={() => handleSkip(step)}
        />
      ))}
      {masteredSteps.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Mastered steps ({masteredSteps.length})</summary>
          <div className="mt-2 space-y-1">
            {masteredSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{step.playbookTitle}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
