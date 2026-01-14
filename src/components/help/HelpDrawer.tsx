import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getModuleHelp } from '@/help/helpRegistry';
import { Separator } from '@/components/ui/separator';
import { HelpChat } from './HelpChat';

interface HelpDrawerProps {
  moduleKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDrawer({ moduleKey, open, onOpenChange }: HelpDrawerProps) {
  const helpContent = getModuleHelp(moduleKey);

  if (!helpContent) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>{helpContent.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 flex-1 overflow-y-auto pr-2">
          {/* Quick Tips */}
          {helpContent.tips.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Quick Tips</h3>
              {helpContent.tips.map((tipGroup, idx) => (
                <div key={idx} className="space-y-2">
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
          )}

          {/* Common Workflows */}
          {helpContent.workflows.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Common Workflows</h3>
                <div className="space-y-4">
                  {helpContent.workflows.map((workflow, idx) => (
                    <div key={idx}>
                      <h4 className="text-xs font-medium text-muted-foreground mb-2">
                        {workflow.title}
                      </h4>
                      <ol className="space-y-1.5">
                        {workflow.steps.map((step, stepIdx) => (
                          <li key={stepIdx} className="text-sm text-foreground flex items-start gap-2">
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
              </div>
            </>
          )}

          {/* Definitions */}
          {helpContent.definitions.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Definitions</h3>
                <dl className="space-y-2">
                  {helpContent.definitions.map((def, idx) => (
                    <div key={idx} className="space-y-1">
                      <dt className="text-sm font-medium text-foreground">{def.term}</dt>
                      <dd className="text-sm text-muted-foreground ml-0">{def.meaning}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}

          {/* Ask ShopFlow Chat */}
          <Separator />
          <div>
            <h3 className="text-sm font-semibold mb-3">Ask ShopFlow</h3>
            <div className="border rounded-lg p-4 bg-muted/30">
              <HelpChat moduleKey={moduleKey} content={helpContent} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
