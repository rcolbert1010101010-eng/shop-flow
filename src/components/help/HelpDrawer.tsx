import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getModuleHelp } from '@/help/helpRegistry';
import { Separator } from '@/components/ui/separator';
import { HelpChat } from './HelpChat';
import type { HelpContext } from '@/help/types';

interface HelpDrawerProps {
  moduleKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: HelpContext;
}

export function HelpDrawer({ moduleKey, open, onOpenChange, context }: HelpDrawerProps) {
  const helpContent = getModuleHelp(moduleKey);

  if (!helpContent) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] h-full flex flex-col p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle className="text-xl font-semibold">{helpContent.title}</SheetTitle>
          <p className="text-sm text-muted-foreground">Contextual help for this screen</p>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {helpContent.tips.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Quick Tips</h3>
              <div className="space-y-2">
                {helpContent.tips.map((tipGroup, idx) => (
                  <div key={idx} className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                    {tipGroup.title && (
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {tipGroup.title}
                      </h4>
                    )}
                    <ul className="space-y-1.5">
                      {tipGroup.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-muted-foreground mt-1.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {helpContent.workflows.length > 0 && (
            <section className="space-y-2">
              <Separator />
              <h3 className="text-sm font-semibold">Common Workflows</h3>
              <div className="space-y-2">
                {helpContent.workflows.map((workflow, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-2"
                  >
                    <h4 className="text-sm font-medium text-foreground">{workflow.title}</h4>
                    <ol className="space-y-1.5 pl-1">
                      {workflow.steps.map((step, stepIdx) => (
                        <li
                          key={stepIdx}
                          className="text-sm text-foreground flex items-start gap-2"
                        >
                          <span className="text-muted-foreground font-medium min-w-[1.5rem]">
                            {stepIdx + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>
          )}

          {helpContent.definitions.length > 0 && (
            <section className="space-y-2">
              <Separator />
              <h3 className="text-sm font-semibold">Key Terms</h3>
              <dl className="space-y-2">
                {helpContent.definitions.map((def, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5"
                  >
                    <dt className="text-sm font-semibold text-foreground">{def.term}</dt>
                    <dd className="text-sm text-muted-foreground">{def.meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="space-y-2">
            <Separator />
            <div>
              <h3 className="text-sm font-semibold">Ask ShopFlow</h3>
              <p className="text-xs text-muted-foreground">
                Answers are local guidance only—no changes are made.
              </p>
            </div>
            <div className="border rounded-lg p-3 bg-muted/30">
              <HelpChat moduleKey={moduleKey} content={helpContent} context={context} />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
